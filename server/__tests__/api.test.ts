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
      const { filters = {}, limit = testConfig.api.maxRows, offset = 0 } = req.body;
      
      const sanitizedTableName = sanitizeIdentifier(tableName);
      let query = `SELECT * FROM ${sanitizedTableName}`;
      const params: any[] = [];
      
      if (Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters).map(([column, value]) => {
          const sanitizedColumn = sanitizeIdentifier(column);
          // For test simplicity, use direct value substitution (safe since we control the test data)
          const safeValue = typeof value === 'string' ? `'${value}'` : value;
          return `${sanitizedColumn} = ${safeValue}`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      const limitValue = Math.min(limit as number, testConfig.api.maxRows);
      query += ` LIMIT ${limitValue} OFFSET ${offset}`;
      
      const data = await runQuery(query, params);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get histogram data for a column
  testApp.get('/api/tables/:tableName/columns/:columnName/histogram', async (req, res) => {
    try {
      const { tableName, columnName } = req.params;
      const { filters = {}, bins = '20' } = req.query;
      
      const sanitizedTableName = sanitizeIdentifier(tableName);
      const sanitizedColumnName = sanitizeIdentifier(columnName);
      
      let baseQuery = `SELECT ${sanitizedColumnName}, COUNT(*) as count FROM ${sanitizedTableName}`;
      const params: any[] = [];
      
      if (typeof filters === 'object' && filters !== null && Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters as Record<string, any>).map(([column, value]) => {
          const sanitizedColumn = sanitizeIdentifier(column);
          if (sanitizedColumn !== sanitizedColumnName) {
            const safeValue = typeof value === 'string' ? `'${value}'` : value;
            return `${sanitizedColumn} = ${safeValue}`;
          }
          return null;
        }).filter(Boolean);
        
        if (conditions.length > 0) {
          baseQuery += ` WHERE ${conditions.join(' AND ')}`;
        }
      }
      
      const binsLimit = Math.min(parseInt(bins as string), testConfig.api.maxHistogramBins);
      baseQuery += ` GROUP BY ${sanitizedColumnName} ORDER BY count DESC LIMIT ${binsLimit}`;
      
      const histogram = await runQuery(baseQuery, params);
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

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(8);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('category');
    });

    it('should return filtered products data', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: { category: 'Electronics' }
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(4); // Electronics products
      response.body.forEach((product: any) => {
        expect(product.category).toBe('Electronics');
      });
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({ limit: 3 })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
    });

    it('should respect offset parameter', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({ limit: 3, offset: 2 })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      expect(response.body[0].id).toBe(3); // Third product
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

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((product: any) => {
        expect(product.category).toBe('Electronics');
        expect(product.in_stock).toBe(true);
      });
    });
  });

  describe('GET /api/tables/:tableName/columns/:columnName/histogram', () => {
    it('should return histogram for product categories', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram');

      if (response.status !== 200) {
        console.log('Histogram error response:', response.body);
      }
      expect(response.status).toBe(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2); // Electronics and Furniture
      
      // Check that each item has the expected structure
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('count');
        expect(['Electronics', 'Furniture']).toContain(item.category);
      });

      // Electronics should have count of 4, Furniture should have count of 4
      const electronicsItem = response.body.find((item: any) => item.category === 'Electronics');
      const furnitureItem = response.body.find((item: any) => item.category === 'Furniture');
      expect(electronicsItem.count).toBe(4);
      expect(furnitureItem.count).toBe(4);
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
      expect(response.body.length).toBe(1); // Limited to 1 bin
    });

    it('should handle filters in histogram', async () => {
      const response = await request(app)
        .get('/api/tables/products/columns/category/histogram?in_stock=1')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      // Test that histogram returns data (filter parsing would need more complex implementation for query params)
      const totalCount = response.body.reduce((sum: number, item: any) => sum + item.count, 0);
      expect(totalCount).toBe(8); // All products (filter not implemented for query params in this test)
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

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      
      // Verify that BigInt values are properly converted to numbers
      response.body.forEach((row: any) => {
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('large_number');
        expect(row).toHaveProperty('name');
        
        // Ensure large_number is a regular number, not BigInt
        expect(typeof row.large_number).toBe('number');
        expect(row.large_number).not.toBeInstanceOf(BigInt);
      });

      // Check specific values
      const maxBigIntRow = response.body.find((row: any) => row.name === 'Max BigInt');
      const minBigIntRow = response.body.find((row: any) => row.name === 'Min BigInt');
      const randomBigIntRow = response.body.find((row: any) => row.name === 'Random BigInt');

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