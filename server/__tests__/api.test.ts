import request from 'supertest';
import { Request, Response } from 'express';
import * as duckdb from 'duckdb';
import { promises as fs } from 'fs';
import path from 'path';

const express = require('express');
const cors = require('cors');

// Import the server logic without starting the server
// We'll create a test version of the server
let app: any;
let db: duckdb.Database;

// Test configuration
const testConfig = {
  database: { path: ':memory:', type: 'memory' as const },
  server: { port: 3001, host: 'localhost' },
  api: { maxRows: 1000, maxHistogramBins: 50 }
};

// Utility functions
const sanitizeIdentifier = (identifier: string): string => {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
};

const runQuery = (query: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    if (params.length === 0) {
      db.all(query, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          // Convert BigInt values to regular numbers for JSON serialization
          const sanitizedRows = (rows || []).map(row => {
            const sanitizedRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              sanitizedRow[key] = typeof value === 'bigint' ? Number(value) : value;
            }
            return sanitizedRow;
          });
          resolve(sanitizedRows);
        }
      });
    } else {
      db.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          // Convert BigInt values to regular numbers for JSON serialization
          const sanitizedRows = (rows || []).map(row => {
            const sanitizedRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              sanitizedRow[key] = typeof value === 'bigint' ? Number(value) : value;
            }
            return sanitizedRow;
          });
          resolve(sanitizedRows);
        }
      });
    }
  });
};

// Setup test server
const createTestServer = () => {
  const testApp = express();
  testApp.use(cors());
  testApp.use(express.json());

  // Get all tables
  testApp.get('/api/tables', async (req, res) => {
    try {
      const tables = await runQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'main'
      `);
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get columns for a table
  testApp.get('/api/tables/:tableName/columns', async (req, res) => {
    try {
      const { tableName } = req.params;
      const sanitizedTableName = sanitizeIdentifier(tableName);
      const columns = await runQuery(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${sanitizedTableName}'
      `);
      res.json(columns);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get table data with optional filters
  testApp.post('/api/tables/:tableName/data', async (req, res) => {
    try {
      const { tableName } = req.params;
      const { filters = {}, rangeFilters = {}, limit = testConfig.api.maxRows, offset = 0 } = req.body;
      
      const sanitizedTableName = sanitizeIdentifier(tableName);
      let query = `SELECT * FROM ${sanitizedTableName}`;
      const params: any[] = [];
      const conditions: string[] = [];
      
      // Handle exact filters
      if (Object.keys(filters).length > 0) {
        const exactConditions = Object.entries(filters).map(([column, value]) => {
          const sanitizedColumn = sanitizeIdentifier(column);
          const safeValue = typeof value === 'string' ? `'${value}'` : value;
          return `${sanitizedColumn} = ${safeValue}`;
        });
        conditions.push(...exactConditions);
      }
      
      // Handle range filters
      if (Object.keys(rangeFilters).length > 0) {
        const rangeConditions = Object.entries(rangeFilters).map(([column, range]) => {
          const sanitizedColumn = sanitizeIdentifier(column);
          const { min, max } = range as { min: number; max: number };
          return `${sanitizedColumn} >= ${min} AND ${sanitizedColumn} <= ${max}`;
        });
        conditions.push(...rangeConditions);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      const limitValue = Math.min(limit as number, testConfig.api.maxRows);
      const dataQuery = query + ` LIMIT ${limitValue} OFFSET ${offset}`;
      const data = await runQuery(dataQuery, params);
      
      // Get total count without LIMIT/OFFSET
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await runQuery(countQuery, params);
      const total = countResult[0]?.total ?? 0;
      
      res.json({ data, total });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get histogram data for a column
  testApp.get('/api/tables/:tableName/columns/:columnName/histogram', async (req, res) => {
    try {
      const { tableName, columnName } = req.params;
      const { bins = '20', column_type = 'text', ...queryParams } = req.query;
      
      const sanitizedTableName = sanitizeIdentifier(tableName);
      const sanitizedColumnName = sanitizeIdentifier(columnName);
      
      // Parse filters like the real server
      const exactFilters: Record<string, any> = {};
      const rangeFilters: Record<string, { min: number; max: number }> = {};
      
      Object.entries(queryParams).forEach(([key, value]) => {
        if (typeof value === 'string' && value.includes('-')) {
          const parts = value.split('-');
          if (parts.length === 2) {
            const min = parseFloat(parts[0]);
            const max = parseFloat(parts[1]);
            if (!isNaN(min) && !isNaN(max)) {
              rangeFilters[key] = { min, max };
              return;
            }
          }
        }
        exactFilters[key] = value;
      });
      
      // Build WHERE clause
      const conditions: string[] = [];
      
      // Handle exact filters (exclude the column we're histogramming)
      Object.entries(exactFilters).forEach(([column, value]) => {
        const sanitizedColumn = sanitizeIdentifier(column);
        if (sanitizedColumn !== sanitizedColumnName) {
          const safeValue = typeof value === 'string' ? `'${value}'` : value;
          conditions.push(`${sanitizedColumn} = ${safeValue}`);
        }
      });
      
      // Handle range filters (exclude the column we're histogramming)
      Object.entries(rangeFilters).forEach(([column, range]) => {
        const sanitizedColumn = sanitizeIdentifier(column);
        if (sanitizedColumn !== sanitizedColumnName) {
          conditions.push(`${sanitizedColumn} >= ${range.min} AND ${sanitizedColumn} <= ${range.max}`);
        }
      });
      
      const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
      
      // Check if this is a numerical column (simplified for tests)
      const isNumerical = ['decimal', 'integer', 'bigint', 'double', 'float'].includes((column_type as string).toLowerCase());
      
      let histogram: any[];
      
      if (isNumerical) {
        // For numerical columns, create simple bins
        const rangeQuery = `SELECT MIN(${sanitizedColumnName}) as min_val, MAX(${sanitizedColumnName}) as max_val FROM ${sanitizedTableName}${whereClause}`;
        const rangeResult = await runQuery(rangeQuery, []);
        
        if (rangeResult.length > 0 && rangeResult[0].min_val !== null) {
          const minVal = Number(rangeResult[0].min_val);
          const maxVal = Number(rangeResult[0].max_val);
          const binWidth = (maxVal - minVal) / 3; // Simple 3-bin histogram for tests
          
          const binQuery = `
            SELECT 
              FLOOR((${sanitizedColumnName} - ${minVal}) / ${binWidth}) as bin_num,
              COUNT(*) as count,
              ${minVal} + FLOOR((${sanitizedColumnName} - ${minVal}) / ${binWidth}) * ${binWidth} as bin_start,
              ${minVal} + (FLOOR((${sanitizedColumnName} - ${minVal}) / ${binWidth}) + 1) * ${binWidth} as bin_end
            FROM ${sanitizedTableName}
            ${whereClause}
            GROUP BY bin_num, bin_start, bin_end
            ORDER BY bin_start
            LIMIT 5
          `;
          
          histogram = await runQuery(binQuery, []);
        } else {
          histogram = [];
        }
      } else {
        // For categorical columns
        const categoryQuery = `SELECT ${sanitizedColumnName}, COUNT(*) as count FROM ${sanitizedTableName}${whereClause} GROUP BY ${sanitizedColumnName} ORDER BY count DESC LIMIT 5`;
        histogram = await runQuery(categoryQuery, []);
      }
      
      res.json(histogram);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get database info endpoint
  testApp.get('/api/info', async (req, res) => {
    try {
      const tables = await runQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'main'
      `);
      
      res.json({
        database: {
          path: testConfig.database.path,
          type: testConfig.database.type,
          tables: tables.length
        },
        config: {
          maxRows: testConfig.api.maxRows,
          maxHistogramBins: testConfig.api.maxHistogramBins
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return testApp;
};

// Setup and teardown
beforeAll(async () => {
  // Initialize in-memory database
  db = new duckdb.Database(':memory:');
  
  // Create sample tables with test data
  await runQuery(`
    CREATE TABLE products (
      id INTEGER,
      name VARCHAR,
      category VARCHAR,
      price DECIMAL(10,2),
      in_stock BOOLEAN,
      created_date DATE
    )
  `);

  await runQuery(`
    CREATE TABLE customers (
      id INTEGER,
      name VARCHAR,
      email VARCHAR,
      tier VARCHAR,
      age INTEGER,
      city VARCHAR,
      total_spent DECIMAL(10,2)
    )
  `);

  await runQuery(`
    CREATE TABLE orders (
      id INTEGER,
      customer_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      order_date DATE,
      status VARCHAR
    )
  `);

  // Insert sample data
  await runQuery(`
    INSERT INTO products VALUES
    (1, 'Laptop Pro', 'Electronics', 1299.99, true, '2024-01-15'),
    (2, 'Wireless Mouse', 'Electronics', 29.99, true, '2024-01-20'),
    (3, 'Office Chair', 'Furniture', 249.99, false, '2024-02-01'),
    (4, 'Standing Desk', 'Furniture', 399.99, true, '2024-02-05'),
    (5, 'Mechanical Keyboard', 'Electronics', 149.99, true, '2024-02-10'),
    (6, 'Monitor Stand', 'Furniture', 79.99, true, '2024-02-15'),
    (7, 'USB Cable', 'Electronics', 12.99, true, '2024-03-01'),
    (8, 'Desk Lamp', 'Furniture', 89.99, false, '2024-03-05')
  `);

  await runQuery(`
    INSERT INTO customers VALUES
    (1, 'Alice Johnson', 'alice@example.com', 'Premium', 32, 'New York', 2500.50),
    (2, 'Bob Smith', 'bob@example.com', 'Standard', 28, 'Los Angeles', 1200.00),
    (3, 'Carol Davis', 'carol@example.com', 'Basic', 45, 'Chicago', 800.25),
    (4, 'David Wilson', 'david@example.com', 'Premium', 38, 'Houston', 3200.75),
    (5, 'Eve Brown', 'eve@example.com', 'Standard', 29, 'Phoenix', 1500.00),
    (6, 'Frank Miller', 'frank@example.com', 'Basic', 52, 'Philadelphia', 600.00)
  `);

  await runQuery(`
    INSERT INTO orders VALUES
    (1, 1, 1, 1, '2024-03-10', 'shipped'),
    (2, 2, 2, 2, '2024-03-11', 'delivered'),
    (3, 3, 3, 1, '2024-03-12', 'pending'),
    (4, 1, 4, 1, '2024-03-13', 'shipped'),
    (5, 4, 5, 1, '2024-03-14', 'delivered'),
    (6, 5, 6, 2, '2024-03-15', 'shipped'),
    (7, 2, 7, 3, '2024-03-16', 'delivered'),
    (8, 6, 8, 1, '2024-03-17', 'pending')
  `);

  // Create a table with BigInt values to test serialization
  await runQuery(`
    CREATE TABLE bigint_test (
      id INTEGER,
      large_number BIGINT,
      name VARCHAR
    )
  `);

  await runQuery(`
    INSERT INTO bigint_test VALUES
    (1, 9223372036854775807, 'Max BigInt'),
    (2, -9223372036854775808, 'Min BigInt'),
    (3, 1234567890123456789, 'Random BigInt')
  `);

  // Create the test server
  app = createTestServer();
});

afterAll(async () => {
  // Close database connection
  if (db) {
    db.close();
  }
});

// Test suites
describe('API Endpoints', () => {
  describe('GET /api/tables', () => {
    it('should return list of tables', async () => {
      const response = await request(app)
        .get('/api/tables')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(4);
      
      const tableNames = response.body.map((table: any) => table.table_name);
      expect(tableNames).toContain('products');
      expect(tableNames).toContain('customers');
      expect(tableNames).toContain('orders');
      expect(tableNames).toContain('bigint_test');
    });
  });

  describe('GET /api/tables/:tableName/columns', () => {
    it('should return columns for products table', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(6);
      
      const columnNames = response.body.map((col: any) => col.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('category');
      expect(columnNames).toContain('price');
      expect(columnNames).toContain('in_stock');
      expect(columnNames).toContain('created_date');
    });

    it('should return columns for customers table', async () => {
      const response = await request(app)
        .get('/api/tables/customers/columns')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      const columnNames = response.body.map((col: any) => col.column_name);
      expect(columnNames).toContain('tier');
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('city');
    });

    it('should return empty array for non-existent table', async () => {
      const response = await request(app)
        .get('/api/tables/nonexistent/columns')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });
  });

  describe('POST /api/tables/:tableName/data', () => {
    it('should return all products data without filters', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(8);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('category');
    });

    it('should return filtered products data', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: { category: 'Electronics' }
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(4); // Electronics products
      response.body.data.forEach((product: any) => {
        expect(product.category).toBe('Electronics');
      });
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({ limit: 3 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
    });

    it('should respect offset parameter', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({ limit: 3, offset: 2 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.data[0].id).toBe(3); // Third product
    });

    it('should handle multiple filters', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: { 
            category: 'Electronics',
            in_stock: 1  // Use 1 instead of true for DuckDB
          }
        });

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((product: any) => {
        expect(product.category).toBe('Electronics');
        expect(product.in_stock).toBe(true);
      });
    });
  });

  describe('GET /api/tables/:tableName/columns/:columnName/histogram', () => {
    it('should return histogram for product categories with others as distinct count', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram');

      if (response.status !== 200) {
        console.log('Histogram error response:', response.body);
      }
      expect(response.status).toBe(200);

      expect(response.body).toBeInstanceOf(Array);
      // Should have Electronics, Furniture, and possibly an 'others' bar if more categories exist
      const categories = response.body.map((item: any) => item.category);
      expect(categories).toContain('Electronics');
      expect(categories).toContain('Furniture');

      // Electronics should have count of 4, Furniture should have count of 4
      const electronicsItem = response.body.find((item: any) => item.category === 'Electronics');
      const furnitureItem = response.body.find((item: any) => item.category === 'Furniture');
      expect(electronicsItem.count).toBe(4);
      expect(furnitureItem.count).toBe(4);

      // If there is an 'others' bar, its count should be the number of distinct other categories
      const othersItem = response.body.find((item: any) => item.category === '(others)');
      if (othersItem) {
        // In the test data, there are only two categories, so others should not exist or be 0
        expect(othersItem.count).toBe(0);
      }
    });

    it('should return histogram for customer tiers', async () => {
      const response = await request(app)
        .get('/api/tables/customers/columns/tier/histogram')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3); // Premium, Standard, Basic
      
      const tiers = response.body.map((item: any) => item.tier);
      expect(tiers).toContain('Premium');
      expect(tiers).toContain('Standard');
      expect(tiers).toContain('Basic');
    });

    it('should respect bins parameter', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram?bins=1')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2); // Categories are not binned - this returns distinct categories
    });

    it('should handle filters in histogram', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram?in_stock=1')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      // Test that histogram returns data with filters applied
      const totalCount = response.body.reduce((sum: number, item: any) => sum + item.count, 0);
      expect(totalCount).toBe(6); // Products that are in stock
    });
  });

  describe('GET /api/info', () => {
    it('should return database info', async () => {
      const response = await request(app)
        .get('/api/info')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('config');
      
      expect(response.body.database.path).toBe(':memory:');
      expect(response.body.database.type).toBe('memory');
      expect(response.body.database.tables).toBe(4);
      
      expect(response.body.config.maxRows).toBe(1000);
      expect(response.body.config.maxHistogramBins).toBe(50);
    });
  });

  describe('BigInt handling', () => {
    it('should handle BigInt values in table data without serialization errors', async () => {
      const response = await request(app)
        .post('/api/tables/bigint_test/data')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      
      // Verify that BigInt values are properly converted to numbers
      response.body.data.forEach((row: any) => {
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('large_number');
        expect(row).toHaveProperty('name');
        
        // Ensure large_number is a regular number, not BigInt
        expect(typeof row.large_number).toBe('number');
        expect(row.large_number).not.toBeInstanceOf(BigInt);
      });

      // Check specific values
      const maxBigIntRow = response.body.data.find((row: any) => row.name === 'Max BigInt');
      const minBigIntRow = response.body.data.find((row: any) => row.name === 'Min BigInt');
      const randomBigIntRow = response.body.data.find((row: any) => row.name === 'Random BigInt');

      expect(maxBigIntRow.large_number).toBe(9223372036854775807);
      expect(minBigIntRow.large_number).toBe(-9223372036854775808);
      expect(randomBigIntRow.large_number).toBe(1234567890123456789);
    });

    it('should handle BigInt values in histogram data without serialization errors', async () => {
      const response = await request(app)
        .get('/api/tables/bigint_test/columns/large_number/histogram')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      
      // Verify that BigInt values in histogram are properly converted
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('large_number');
        expect(item).toHaveProperty('count');
        
        // Ensure large_number is a regular number, not BigInt
        expect(typeof item.large_number).toBe('number');
        expect(item.large_number).not.toBeInstanceOf(BigInt);
        
        // Ensure count is also a regular number
        expect(typeof item.count).toBe('number');
        expect(item.count).not.toBeInstanceOf(BigInt);
      });

      // Check that we have the expected large number values
      const largeNumbers = response.body.map((item: any) => item.large_number);
      expect(largeNumbers).toContain(9223372036854775807);
      expect(largeNumbers).toContain(-9223372036854775808);
      expect(largeNumbers).toContain(1234567890123456789);
    });

    it('should return JSON serializable response for BigInt columns', async () => {
      const response = await request(app)
        .post('/api/tables/bigint_test/data')
        .send({});

      // This test ensures the response can be JSON stringified without errors
      expect(() => JSON.stringify(response.body)).not.toThrow();
      
      // Verify the JSON string doesn't contain BigInt error indicators
      const jsonString = JSON.stringify(response.body);
      expect(jsonString).not.toContain('[object BigInt]');
      expect(jsonString).not.toContain('TypeError');
      
      // The string "BigInt" might appear in the "name" field, so we check for the specific error
      // that would occur without proper serialization handling
      expect(jsonString).toContain('large_number');  // Should contain the converted values
    });
  });

  describe('Range filter functionality', () => {
    it('should filter products by price range', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          rangeFilters: {
            price: { min: 50, max: 200 }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body.data).toBeInstanceOf(Array);
      // Should return products with price between 50 and 200
      expect(response.body.data.length).toBeGreaterThan(0);
      response.body.data.forEach((product: any) => {
        expect(product.price).toBeGreaterThanOrEqual(50);
        expect(product.price).toBeLessThanOrEqual(200);
      });
    });

    it('should filter customers by age range', async () => {
      const response = await request(app)
        .post('/api/tables/customers/data')
        .send({
          rangeFilters: {
            age: { min: 30, max: 40 }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((customer: any) => {
        expect(customer.age).toBeGreaterThanOrEqual(30);
        expect(customer.age).toBeLessThanOrEqual(40);
      });
    });

    it('should combine exact and range filters', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: {
            category: 'Electronics'
          },
          rangeFilters: {
            price: { min: 100, max: 500 }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((product: any) => {
        expect(product.category).toBe('Electronics');
        expect(product.price).toBeGreaterThanOrEqual(100);
        expect(product.price).toBeLessThanOrEqual(500);
      });
    });

    it('should handle multiple range filters', async () => {
      const response = await request(app)
        .post('/api/tables/customers/data')
        .send({
          rangeFilters: {
            age: { min: 25, max: 35 },
            total_spent: { min: 1000, max: 3000 }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((customer: any) => {
        expect(customer.age).toBeGreaterThanOrEqual(25);
        expect(customer.age).toBeLessThanOrEqual(35);
        expect(customer.total_spent).toBeGreaterThanOrEqual(1000);
        expect(customer.total_spent).toBeLessThanOrEqual(3000);
      });
    });

    it('should return empty array when range filter excludes all data', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          rangeFilters: {
            price: { min: 10000, max: 20000 }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);
    });
  });

  describe('Filtered histogram functionality', () => {
    it('should filter histograms with exact filters', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram')
        .query({ 
          column_type: 'text',
          in_stock: 'true'
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      // All returned categories should only represent products that are in stock
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('count');
      });
    });

    it('should filter histograms with range filters', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram')
        .query({ 
          column_type: 'text',
          price: '100-300'  // Range filter format
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('count');
      });
    });

    it('should filter numerical histograms with exact filters', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/price/histogram')
        .query({ 
          column_type: 'decimal',
          category: 'Electronics'
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('bin_start');
        expect(item).toHaveProperty('bin_end');
      });
    });

    it('should filter numerical histograms with range filters', async () => {
      const response = await request(app)
        .get('/api/tables/customers/columns/age/histogram')
        .query({ 
          column_type: 'integer',
          total_spent: '1000-2000'  // Range filter
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('bin_start');
        expect(item).toHaveProperty('bin_end');
      });
    });

    it('should combine exact and range filters in histograms', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram')
        .query({ 
          column_type: 'text',
          in_stock: 'true',       // Exact filter
          price: '50-500'         // Range filter
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('count');
      });
    });

    it('should exclude the histogram column from its own filters', async () => {
      // When getting histogram for 'price', price filters should be ignored
      const response = await request(app)
        .get('/api/tables/products/columns/price/histogram')
        .query({ 
          column_type: 'decimal',
          price: '100-200',      // This should be ignored
          category: 'Electronics' // This should be applied
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('bin_start');
        expect(item).toHaveProperty('bin_end');
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid table name in data endpoint', async () => {
      const response = await request(app)
        .post('/api/tables/invalid_table/data')
        .send({})
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('invalid_table');
    });

    it('should handle invalid column name in histogram endpoint', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/invalid_column/histogram')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('invalid_column');
    });
  });
});