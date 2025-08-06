import request from 'supertest';
import { createServer } from '../server';
import * as duckdb from 'duckdb';

// Create test database and server
let app: any;
let runQuery: any;
let db: duckdb.Database;

// Setup and teardown
beforeAll(async () => {
  // Create in-memory database for tests
  db = new duckdb.Database(':memory:');
  
  // Create server with test database and config
  const testConfig = {
    database: { path: ':memory:', type: 'memory' as const },
    server: { port: 3001, host: 'localhost' },
    api: { maxRows: 1000, maxHistogramBins: 50 }
  };
  
  const server = createServer(db, testConfig);
  app = server.app;
  runQuery = server.runQuery;
  
  // Create test tables
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

  // Create tables with foreign key constraints for testing foreign key introspection
  await runQuery(`
    CREATE TABLE test_customers (
      customer_id INTEGER PRIMARY KEY,
      name VARCHAR,
      email VARCHAR
    )
  `);

  await runQuery(`
    CREATE TABLE test_categories (
      category_id INTEGER PRIMARY KEY,
      category_name VARCHAR,
      description VARCHAR
    )
  `);

  await runQuery(`
    CREATE TABLE test_products (
      product_id INTEGER PRIMARY KEY,
      product_name VARCHAR,
      category_id INTEGER,
      price DECIMAL(10,2),
      FOREIGN KEY (category_id) REFERENCES test_categories(category_id)
    )
  `);

  await runQuery(`
    CREATE TABLE test_orders (
      order_id INTEGER PRIMARY KEY,
      customer_id INTEGER,
      order_date DATE,
      total_amount DECIMAL(10,2),
      FOREIGN KEY (customer_id) REFERENCES test_customers(customer_id)
    )
  `);

  await runQuery(`
    CREATE TABLE test_order_items (
      order_item_id INTEGER PRIMARY KEY,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      unit_price DECIMAL(10,2),
      FOREIGN KEY (order_id) REFERENCES test_orders(order_id),
      FOREIGN KEY (product_id) REFERENCES test_products(product_id)
    )
  `);

  await runQuery(`
    CREATE TABLE bigint_test (
      id INTEGER,
      large_number BIGINT,
      name VARCHAR
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

  await runQuery(`
    INSERT INTO bigint_test VALUES
    (1, 9223372036854775807, 'Max BigInt'),
    (2, -9223372036854775808, 'Min BigInt'),
    (3, 1234567890123456789, 'Random BigInt')
  `);
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
      expect(response.body.length).toBe(9);
      
      const tableNames = response.body.map((table: any) => table.table_name);
      expect(tableNames).toContain('products');
      expect(tableNames).toContain('customers');
      expect(tableNames).toContain('orders');
      expect(tableNames).toContain('bigint_test');
      expect(tableNames).toContain('test_customers');
      expect(tableNames).toContain('test_categories');
      expect(tableNames).toContain('test_products');
      expect(tableNames).toContain('test_orders');
      expect(tableNames).toContain('test_order_items');
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

    it('should handle multiple filters with exact and range filters', async () => {
      // Test with 3 filters: category, in_stock, and price range
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: { 
            category: 'Electronics',
            in_stock: 1  // Use 1 instead of true for DuckDB
          },
          rangeFilters: {
            price: { min: 100, max: 500 }  // This should exclude USB Cable (12.99) and Wireless Mouse (29.99)
          }
        });

      if (response.status !== 200) {
        console.log('Error response:', response.body);
      }
      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1); // Should return only Mechanical Keyboard (149.99)
      response.body.data.forEach((product: any) => {
        expect(product.category).toBe('Electronics');
        expect(product.in_stock).toBe(true);
        expect(product.price).toBeGreaterThanOrEqual(100);
        expect(product.price).toBeLessThanOrEqual(500);
      });

      // Verify we got the expected products
      const productNames = response.body.data.map((p: any) => p.name);
      expect(productNames).toContain('Mechanical Keyboard');
      // Note: Laptop Pro (1299.99) is above 500, so it should be excluded
      expect(productNames).not.toContain('Laptop Pro');
      expect(productNames).not.toContain('USB Cable');
      expect(productNames).not.toContain('Wireless Mouse');
    });

    it('should handle multiple exact filters only', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: { 
            category: 'Furniture',
            in_stock: 1  // Only in-stock furniture
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2); // Standing Desk, Monitor Stand
      response.body.data.forEach((product: any) => {
        expect(product.category).toBe('Furniture');
        expect(product.in_stock).toBe(true);
      });
    });

    it('should handle multiple range filters only', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          rangeFilters: {
            price: { min: 50, max: 300 },
            id: { min: 2, max: 6 }  // Limit to specific ID range
          }
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      response.body.data.forEach((product: any) => {
        expect(product.price).toBeGreaterThanOrEqual(50);
        expect(product.price).toBeLessThanOrEqual(300);
        expect(product.id).toBeGreaterThanOrEqual(2);
        expect(product.id).toBeLessThanOrEqual(6);
      });
    });
  });

  describe('POST /api/tables/:tableName/columns/:columnName/histogram', () => {
    it('should return histogram for product categories with others as distinct count', async () => {
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({
          column_type: 'text'
        });

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
        .post('/api/tables/customers/columns/tier/histogram')
        .send({
          column_type: 'text'
        })
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
        .post('/api/tables/products/columns/category/histogram')
        .send({
          bins: 1,
          column_type: 'text'
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2); // Categories are not binned - this returns distinct categories
    });

    it('should handle filters in histogram', async () => {
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({
          column_type: 'text',
          filters: [{ type: 'exact', column: 'in_stock', value: '1' }]
        })
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
      expect(response.body.database.tables).toBe(9);
      
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
        .post('/api/tables/bigint_test/columns/large_number/histogram')
        .send({
          column_type: 'bigint'
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      // For BIGINT columns (treated as categorical), histogram returns grouped data
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('large_number'); // Column name property
        
        // Ensure all numeric values are properly converted from BigInt
        expect(typeof item.count).toBe('number');
        expect(item.count).not.toBeInstanceOf(BigInt);
        
        // The large_number value should also be converted from BigInt
        if (typeof item.large_number === 'number') {
          expect(item.large_number).not.toBeInstanceOf(BigInt);
        }
        
        // For BigInt values, we may have bin_value instead of bin_num
        if (item.hasOwnProperty('bin_num')) {
          expect(typeof item.bin_num).toBe('number');
          expect(item.bin_num).not.toBeInstanceOf(BigInt);
        }
        if (item.hasOwnProperty('bin_value')) {
          expect(typeof item.bin_value).toBe('number');
          expect(item.bin_value).not.toBeInstanceOf(BigInt);
        }
      });
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
        .post('/api/tables/products/columns/category/histogram')
        .send({ 
          column_type: 'text',
          filters: [{ type: 'exact', column: 'in_stock', value: 'true' }]
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
        .post('/api/tables/products/columns/category/histogram')
        .send({ 
          column_type: 'text',
          filters: [{ type: 'range', column: 'price', min: 100, max: 300 }]
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
        .post('/api/tables/products/columns/price/histogram')
        .send({ 
          column_type: 'decimal',
          filters: [{ type: 'exact', column: 'category', value: 'Electronics' }]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('bin_start');
        expect(item).toHaveProperty('bin_end');
      });
    });

    it('should filter categorical histograms with range filters', async () => {
      const response = await request(app)
        .post('/api/tables/customers/columns/age/histogram')
        .send({ 
          column_type: 'integer',
          filters: [{ type: 'range', column: 'total_spent', min: 1000, max: 2000 }]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('age'); // Column name property for categorical
        expect(item).toHaveProperty('is_others'); // Should indicate if it's "others" group
      });
    });

    it('should combine exact and range filters in histograms', async () => {
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({ 
          column_type: 'text',
          filters: [
            { type: 'exact', column: 'in_stock', value: 'true' },
            { type: 'range', column: 'price', min: 50, max: 500 }
          ]
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
        .post('/api/tables/products/columns/price/histogram')
        .send({ 
          column_type: 'decimal',
          filters: [
            { type: 'range', column: 'price', min: 100, max: 200 }, // This should be ignored
            { type: 'exact', column: 'category', value: 'Electronics' } // This should be applied
          ]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('count');
        expect(item).toHaveProperty('bin_start');
        expect(item).toHaveProperty('bin_end');
      });
    });

    it('should handle histogram with both exact and range filters', async () => {
      // Test the specific bug case: exact + range filters together in histogram
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({ 
          column_type: 'text',
          filters: [
            { type: 'exact', column: 'in_stock', value: 'true' },
            { type: 'range', column: 'price', min: 50, max: 500 }
          ]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('count');
      });
    });
  });

  describe('Histogram "others" count calculation', () => {
    beforeAll(async () => {
      // Create a test table with many distinct values to test "others" calculation
      await runQuery(`
        CREATE TABLE many_categories (
          id INTEGER,
          category VARCHAR,
          value INTEGER
        )
      `);

      // Insert data with 10 distinct categories, each with different row counts
      await runQuery(`
        INSERT INTO many_categories VALUES
        (1, 'cat_a', 100), (2, 'cat_a', 101), (3, 'cat_a', 102), (4, 'cat_a', 103), (5, 'cat_a', 104),
        (6, 'cat_b', 200), (7, 'cat_b', 201), (8, 'cat_b', 202), (9, 'cat_b', 203),
        (10, 'cat_c', 300), (11, 'cat_c', 301), (12, 'cat_c', 302),
        (13, 'cat_d', 400), (14, 'cat_d', 401),
        (15, 'cat_e', 500),
        (16, 'cat_f', 600),
        (17, 'cat_g', 700),
        (18, 'cat_h', 800),
        (19, 'cat_i', 900),
        (20, 'cat_j', 1000)
      `);
    });

    it('should calculate others count correctly when there are more categories than top_n', async () => {
      // Request top 3 categories - should get 3 individual + 1 "others" entry
      const response = await request(app)
        .post('/api/tables/many_categories/columns/category/histogram')
        .send({
          column_type: 'text',
          top_n: 3
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      
      // Should have 4 items: top 3 categories + 1 "others"
      expect(response.body.length).toBe(4);

      // Find the "others" entry
      const othersItem = response.body.find((item: any) => item.is_others === true);
      expect(othersItem).toBeDefined();
      
      // Calculate expected others count:
      // Total rows = 20, Top 3 categories have 5+4+3=12 rows, so others should have 8 rows
      expect(othersItem.count).toBe(8);
      
      // Others should represent 7 distinct categories (10 total - 3 top = 7 others)
      expect(othersItem.distinct_count).toBe(7);
      expect(othersItem.category).toContain('7 other value');

      // Verify total count adds up correctly
      const totalCount = response.body.reduce((sum: number, item: any) => sum + item.count, 0);
      expect(totalCount).toBe(20); // Should equal total rows in table

      // Verify top 3 categories are the ones with highest counts
      const nonOthersItems = response.body.filter((item: any) => !item.is_others);
      expect(nonOthersItems.length).toBe(3);
      
      // Sort by count descending to verify order
      const sortedItems = nonOthersItems.sort((a: any, b: any) => b.count - a.count);
      expect(sortedItems[0].count).toBe(5); // cat_a
      expect(sortedItems[1].count).toBe(4); // cat_b  
      expect(sortedItems[2].count).toBe(3); // cat_c
    });

    it('should not show others when top_n includes all categories', async () => {
      // Request top 15 categories - should get all 10 categories, no "others"
      const response = await request(app)
        .post('/api/tables/many_categories/columns/category/histogram')
        .send({
          column_type: 'text',
          top_n: 15
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      
      // Should have exactly 10 items (all categories, no "others")
      expect(response.body.length).toBe(10);

      // Should not have any "others" entry
      const othersItem = response.body.find((item: any) => item.is_others === true);
      expect(othersItem).toBeUndefined();

      // Verify total count is still correct
      const totalCount = response.body.reduce((sum: number, item: any) => sum + item.count, 0);
      expect(totalCount).toBe(20);
    });

    it('should calculate others count correctly with filters applied', async () => {
      // Test with a filter that excludes some rows
      const response = await request(app)
        .post('/api/tables/many_categories/columns/category/histogram')
        .send({
          column_type: 'text',
          top_n: 2,
          filters: [{ type: 'range', column: 'value', min: 200, max: 800 }] // This should exclude cat_a (100s) and cat_i/cat_j (900+)
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      
      // Find the "others" entry
      const othersItem = response.body.find((item: any) => item.is_others === true);
      if (othersItem) {
        // Verify that the others count represents the correct number of remaining rows
        // after applying filters and excluding the top N
        const topItems = response.body.filter((item: any) => !item.is_others);
        const topCount = topItems.reduce((sum: number, item: any) => sum + item.count, 0);
        const totalCount = topCount + othersItem.count;
        
        // Total should be less than 20 due to the value filter
        expect(totalCount).toBeLessThan(20);
        expect(totalCount).toBeGreaterThan(0);
        
        // Verify arithmetic: total filtered rows = top N rows + others rows
        expect(totalCount).toBe(topCount + othersItem.count);
      }
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
        .post('/api/tables/products/columns/invalid_column/histogram')
        .send({ column_type: 'text' })
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Date handling', () => {
    it('should return date columns as ISO strings in table data', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      // created_date should be an ISO string
      response.body.data.forEach((row: any) => {
        expect(typeof row.created_date).toBe('string');
        // Should match ISO date format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)
        expect(row.created_date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      });
    });
  });

  describe('Foreign Key Introspection', () => {
    describe('GET /api/tables/:tableName/columns with foreign keys', () => {
      it('should return columns without foreign key info for tables without foreign keys', async () => {
        const response = await request(app)
          .get('/api/tables/test_customers/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(3); // customer_id, name, email
        
        response.body.forEach((column: any) => {
          expect(column).toHaveProperty('column_name');
          expect(column).toHaveProperty('data_type');
          expect(column).toHaveProperty('no_histogram');
          expect(column).not.toHaveProperty('foreign_key');
        });

        const columnNames = response.body.map((col: any) => col.column_name);
        expect(columnNames).toContain('customer_id');
        expect(columnNames).toContain('name');
        expect(columnNames).toContain('email');
      });

      it('should return foreign key info for test_products table', async () => {
        const response = await request(app)
          .get('/api/tables/test_products/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(4); // product_id, product_name, category_id, price
        
        const columnNames = response.body.map((col: any) => col.column_name);
        expect(columnNames).toContain('product_id');
        expect(columnNames).toContain('product_name');
        expect(columnNames).toContain('category_id');
        expect(columnNames).toContain('price');

        // Find the category_id column which should have foreign key info
        const categoryIdColumn = response.body.find((col: any) => col.column_name === 'category_id');
        expect(categoryIdColumn).toBeDefined();
        expect(categoryIdColumn).toHaveProperty('foreign_key');
        expect(categoryIdColumn.foreign_key).toHaveProperty('referenced_table');
        expect(categoryIdColumn.foreign_key).toHaveProperty('referenced_column');
        expect(categoryIdColumn.foreign_key.referenced_table).toBe('test_categories');
        expect(categoryIdColumn.foreign_key.referenced_column).toBe('category_id');

        // Other columns should not have foreign key info
        const productIdColumn = response.body.find((col: any) => col.column_name === 'product_id');
        const productNameColumn = response.body.find((col: any) => col.column_name === 'product_name');
        const priceColumn = response.body.find((col: any) => col.column_name === 'price');
        
        expect(productIdColumn.foreign_key).toBeUndefined();
        expect(productNameColumn.foreign_key).toBeUndefined();
        expect(priceColumn.foreign_key).toBeUndefined();
      });

      it('should return foreign key info for test_orders table', async () => {
        const response = await request(app)
          .get('/api/tables/test_orders/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(4); // order_id, customer_id, order_date, total_amount
        
        // Find the customer_id column which should have foreign key info
        const customerIdColumn = response.body.find((col: any) => col.column_name === 'customer_id');
        expect(customerIdColumn).toBeDefined();
        expect(customerIdColumn).toHaveProperty('foreign_key');
        expect(customerIdColumn.foreign_key.referenced_table).toBe('test_customers');
        expect(customerIdColumn.foreign_key.referenced_column).toBe('customer_id');

        // Other columns should not have foreign key info
        const otherColumns = response.body.filter((col: any) => col.column_name !== 'customer_id');
        otherColumns.forEach((column: any) => {
          expect(column.foreign_key).toBeUndefined();
        });
      });

      it('should return multiple foreign key relationships for test_order_items table', async () => {
        const response = await request(app)
          .get('/api/tables/test_order_items/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(5); // order_item_id, order_id, product_id, quantity, unit_price
        
        // Find the order_id column which should have foreign key info
        const orderIdColumn = response.body.find((col: any) => col.column_name === 'order_id');
        expect(orderIdColumn).toBeDefined();
        expect(orderIdColumn).toHaveProperty('foreign_key');
        expect(orderIdColumn.foreign_key.referenced_table).toBe('test_orders');
        expect(orderIdColumn.foreign_key.referenced_column).toBe('order_id');

        // Find the product_id column which should have foreign key info
        const productIdColumn = response.body.find((col: any) => col.column_name === 'product_id');
        expect(productIdColumn).toBeDefined();
        expect(productIdColumn).toHaveProperty('foreign_key');
        expect(productIdColumn.foreign_key.referenced_table).toBe('test_products');
        expect(productIdColumn.foreign_key.referenced_column).toBe('product_id');

        // Other columns should not have foreign key info
        const otherColumns = response.body.filter((col: any) => 
          col.column_name !== 'order_id' && col.column_name !== 'product_id'
        );
        otherColumns.forEach((column: any) => {
          expect(column.foreign_key).toBeUndefined();
        });
      });

      it('should handle tables without foreign key constraints', async () => {
        const response = await request(app)
          .get('/api/tables/products/columns') // Original products table without foreign keys
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        response.body.forEach((column: any) => {
          expect(column).toHaveProperty('column_name');
          expect(column).toHaveProperty('data_type');
          expect(column).toHaveProperty('no_histogram');
          expect(column.foreign_key).toBeUndefined();
        });
      });

      it('should handle non-existent tables gracefully', async () => {
        const response = await request(app)
          .get('/api/tables/non_existent_table/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(0);
      });

      it('should include foreign key info alongside no_histogram flag', async () => {
        const response = await request(app)
          .get('/api/tables/test_products/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        response.body.forEach((column: any) => {
          expect(column).toHaveProperty('column_name');
          expect(column).toHaveProperty('data_type');
          expect(column).toHaveProperty('no_histogram');
          
          // The no_histogram flag should be a boolean
          expect(typeof column.no_histogram).toBe('boolean');
          
          // If foreign_key exists, it should have the correct structure
          if (column.foreign_key) {
            expect(column.foreign_key).toHaveProperty('referenced_table');
            expect(column.foreign_key).toHaveProperty('referenced_column');
            expect(typeof column.foreign_key.referenced_table).toBe('string');
            expect(typeof column.foreign_key.referenced_column).toBe('string');
          }
        });
      });
    });

    describe('Foreign key constraint validation', () => {
      it('should correctly identify single foreign key constraint', async () => {
        // Test that we can query the constraint information directly
        const constraints = await runQuery(`
          SELECT constraint_column_names, referenced_table, referenced_column_names
          FROM duckdb_constraints 
          WHERE table_name = 'test_products' 
          AND constraint_type = 'FOREIGN KEY'
        `);

        expect(Array.isArray(constraints)).toBe(true);
        expect(constraints.length).toBe(1);
        expect(constraints[0].constraint_column_names).toEqual(['category_id']);
        expect(constraints[0].referenced_table).toBe('test_categories');
        expect(constraints[0].referenced_column_names).toEqual(['category_id']);
      });

      it('should correctly identify multiple foreign key constraints', async () => {
        const constraints = await runQuery(`
          SELECT constraint_column_names, referenced_table, referenced_column_names
          FROM duckdb_constraints 
          WHERE table_name = 'test_order_items' 
          AND constraint_type = 'FOREIGN KEY'
          ORDER BY constraint_column_names[1] -- Sort by first column name
        `);

        expect(Array.isArray(constraints)).toBe(true);
        expect(constraints.length).toBe(2);

        // Should have order_id -> test_orders and product_id -> test_products
        const orderConstraint = constraints.find((c: any) => c.constraint_column_names[0] === 'order_id');
        const productConstraint = constraints.find((c: any) => c.constraint_column_names[0] === 'product_id');

        expect(orderConstraint).toBeDefined();
        expect(orderConstraint.referenced_table).toBe('test_orders');
        expect(orderConstraint.referenced_column_names).toEqual(['order_id']);

        expect(productConstraint).toBeDefined();
        expect(productConstraint.referenced_table).toBe('test_products');
        expect(productConstraint.referenced_column_names).toEqual(['product_id']);
      });

      it('should return empty array for tables without foreign keys', async () => {
        const constraints = await runQuery(`
          SELECT constraint_column_names, referenced_table, referenced_column_names
          FROM duckdb_constraints 
          WHERE table_name = 'test_customers' 
          AND constraint_type = 'FOREIGN KEY'
        `);

        expect(Array.isArray(constraints)).toBe(true);
        expect(constraints.length).toBe(0);
      });
    });

    describe('Foreign key data types validation', () => {
      it('should maintain correct data types for all column properties', async () => {
        const response = await request(app)
          .get('/api/tables/test_order_items/columns')
          .expect(200);

        const orderIdColumn = response.body.find((col: any) => col.column_name === 'order_id');
        
        // Validate the structure and types
        expect(typeof orderIdColumn.column_name).toBe('string');
        expect(typeof orderIdColumn.data_type).toBe('string');
        expect(typeof orderIdColumn.no_histogram).toBe('boolean');
        expect(typeof orderIdColumn.foreign_key).toBe('object');
        expect(orderIdColumn.foreign_key).not.toBeNull();
        expect(typeof orderIdColumn.foreign_key.referenced_table).toBe('string');
        expect(typeof orderIdColumn.foreign_key.referenced_column).toBe('string');
      });
    });

    describe('Reverse Foreign Key (Inward) Detection', () => {
      it('should return reverse foreign key info for test_customers table', async () => {
        const response = await request(app)
          .get('/api/tables/test_customers/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(3); // customer_id, name, email
        
        // Find the customer_id column which should have reverse foreign key info
        const customerIdColumn = response.body.find((col: any) => col.column_name === 'customer_id');
        expect(customerIdColumn).toBeDefined();
        expect(customerIdColumn).toHaveProperty('reverse_foreign_keys');
        expect(Array.isArray(customerIdColumn.reverse_foreign_keys)).toBe(true);
        expect(customerIdColumn.reverse_foreign_keys.length).toBe(1);
        
        const reverseFk = customerIdColumn.reverse_foreign_keys[0];
        expect(reverseFk).toHaveProperty('source_table');
        expect(reverseFk).toHaveProperty('source_column');
        expect(reverseFk.source_table).toBe('test_orders');
        expect(reverseFk.source_column).toBe('customer_id');

        // Other columns should not have reverse foreign key info
        const otherColumns = response.body.filter((col: any) => col.column_name !== 'customer_id');
        otherColumns.forEach((column: any) => {
          expect(column.reverse_foreign_keys).toBeUndefined();
        });
      });

      it('should return reverse foreign key info for test_categories table', async () => {
        const response = await request(app)
          .get('/api/tables/test_categories/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(3); // category_id, category_name, description
        
        // Find the category_id column which should have reverse foreign key info
        const categoryIdColumn = response.body.find((col: any) => col.column_name === 'category_id');
        expect(categoryIdColumn).toBeDefined();
        expect(categoryIdColumn).toHaveProperty('reverse_foreign_keys');
        expect(Array.isArray(categoryIdColumn.reverse_foreign_keys)).toBe(true);
        expect(categoryIdColumn.reverse_foreign_keys.length).toBe(1);
        
        const reverseFk = categoryIdColumn.reverse_foreign_keys[0];
        expect(reverseFk.source_table).toBe('test_products');
        expect(reverseFk.source_column).toBe('category_id');
      });

      it('should return multiple reverse foreign key relationships for test_products table', async () => {
        const response = await request(app)
          .get('/api/tables/test_products/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(4); // product_id, product_name, category_id, price
        
        // Find the product_id column which should have reverse foreign key info
        const productIdColumn = response.body.find((col: any) => col.column_name === 'product_id');
        expect(productIdColumn).toBeDefined();
        expect(productIdColumn).toHaveProperty('reverse_foreign_keys');
        expect(Array.isArray(productIdColumn.reverse_foreign_keys)).toBe(true);
        expect(productIdColumn.reverse_foreign_keys.length).toBe(1);
        
        const reverseFk = productIdColumn.reverse_foreign_keys[0];
        expect(reverseFk.source_table).toBe('test_order_items');
        expect(reverseFk.source_column).toBe('product_id');

        // category_id should have a regular foreign key but no reverse foreign keys
        const categoryIdColumn = response.body.find((col: any) => col.column_name === 'category_id');
        expect(categoryIdColumn).toBeDefined();
        expect(categoryIdColumn.foreign_key).toBeDefined();
        expect(categoryIdColumn.reverse_foreign_keys).toBeUndefined();
      });

      it('should return multiple reverse foreign key relationships for test_orders table', async () => {
        const response = await request(app)
          .get('/api/tables/test_orders/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBe(4); // order_id, customer_id, order_date, total_amount
        
        // Find the order_id column which should have reverse foreign key info
        const orderIdColumn = response.body.find((col: any) => col.column_name === 'order_id');
        expect(orderIdColumn).toBeDefined();
        expect(orderIdColumn).toHaveProperty('reverse_foreign_keys');
        expect(Array.isArray(orderIdColumn.reverse_foreign_keys)).toBe(true);
        expect(orderIdColumn.reverse_foreign_keys.length).toBe(1);
        
        const reverseFk = orderIdColumn.reverse_foreign_keys[0];
        expect(reverseFk.source_table).toBe('test_order_items');
        expect(reverseFk.source_column).toBe('order_id');

        // customer_id should have a regular foreign key but no reverse foreign keys
        const customerIdColumn = response.body.find((col: any) => col.column_name === 'customer_id');
        expect(customerIdColumn).toBeDefined();
        expect(customerIdColumn.foreign_key).toBeDefined();
        expect(customerIdColumn.reverse_foreign_keys).toBeUndefined();
      });

      it('should include both foreign_key and reverse_foreign_keys alongside no_histogram flag', async () => {
        const response = await request(app)
          .get('/api/tables/test_products/columns')
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        response.body.forEach((column: any) => {
          expect(column).toHaveProperty('column_name');
          expect(column).toHaveProperty('data_type');
          expect(column).toHaveProperty('no_histogram');
          
          // The no_histogram flag should be a boolean
          expect(typeof column.no_histogram).toBe('boolean');
          
          // If foreign_key exists, it should have the correct structure
          if (column.foreign_key) {
            expect(column.foreign_key).toHaveProperty('referenced_table');
            expect(column.foreign_key).toHaveProperty('referenced_column');
            expect(typeof column.foreign_key.referenced_table).toBe('string');
            expect(typeof column.foreign_key.referenced_column).toBe('string');
          }

          // If reverse_foreign_keys exist, they should have the correct structure
          if (column.reverse_foreign_keys) {
            expect(Array.isArray(column.reverse_foreign_keys)).toBe(true);
            column.reverse_foreign_keys.forEach((reverseFk: any) => {
              expect(reverseFk).toHaveProperty('source_table');
              expect(reverseFk).toHaveProperty('source_column');
              expect(typeof reverseFk.source_table).toBe('string');
              expect(typeof reverseFk.source_column).toBe('string');
            });
          }
        });
      });

      it('should handle tables with no reverse foreign keys', async () => {
        const response = await request(app)
          .get('/api/tables/test_order_items/columns') // Leaf table with no reverse FKs
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        response.body.forEach((column: any) => {
          expect(column).toHaveProperty('column_name');
          expect(column).toHaveProperty('data_type');
          expect(column).toHaveProperty('no_histogram');
          
          // test_order_items is a leaf table, so no columns should have reverse foreign keys
          expect(column.reverse_foreign_keys).toBeUndefined();
        });
      });
    });
  });

  describe('Filtered discrete histogram behavior', () => {
    it('should show only the filtered value for discrete histograms when column is filtered', async () => {
      // When requesting a histogram for a column that has an exact filter,
      // the histogram should show only that filtered value
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({
          column_type: 'text',
          filters: [
            { type: 'exact', column: 'category', value: 'Electronics' }, // Filter for Electronics
            { type: 'exact', column: 'in_stock', value: true } // Other filter should still apply
          ]
        });

      if (response.status !== 200) {
        console.log('Filtered discrete histogram error:', response.status, response.body);
      }
      
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1); // Should only show the filtered value
      
      const histogramItem = response.body[0];
      expect(histogramItem.category).toBe('Electronics');
      expect(typeof histogramItem.count).toBe('number'); // Should provide actual count for filtered value
    });

    it('should show normal histogram when no filter exists for that column', async () => {
      // Normal behavior - when column is not filtered, show all values
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({
          column_type: 'text',
          filters: [
            { type: 'exact', column: 'in_stock', value: true } // Filter on different column
          ]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(1); // Should show multiple categories
      
      // None should be marked as filtered
      response.body.forEach((item: any) => {
        expect(item.is_filtered).toBeUndefined();
        expect(typeof item.count).toBe('number');
      });
    });

    it('should show normal histogram for numerical columns even when filtered', async () => {
      // Numerical histograms should still show the full distribution even when filtered
      const response = await request(app)
        .post('/api/tables/products/columns/price/histogram')
        .send({
          column_type: 'decimal',
          filters: [
            { type: 'exact', column: 'price', value: 29.99 } // Filter on the price column itself
          ]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      // Should still show histogram bins, not just the filtered value
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('bin_start');
        expect(item).toHaveProperty('bin_end');
        expect(item).toHaveProperty('count');
        expect(item.is_filtered).toBeUndefined(); // Numerical histograms don't get special filtered treatment
      });
    });

    it('should handle multiple exact filters correctly, only affecting the histogram column', async () => {
      // Test with multiple filters - only the one for the histogram column should trigger special behavior
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({
          column_type: 'text',
          filters: [
            { type: 'exact', column: 'category', value: 'Furniture' }, // This should trigger filtered behavior
            { type: 'exact', column: 'in_stock', value: true },       // This should be ignored for histogram
            { type: 'range', column: 'price', min: 50, max: 500 }      // This should be ignored for histogram
          ]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].category).toBe('Furniture');
    });
  });

  describe('Numeric filter bug fix', () => {
    it('should handle numeric exact filters in histogram without throwing "replace is not a function" error', async () => {
      // This test reproduces the original bug where numeric filters in histograms caused
      // "filter.value.replace is not a function" error
      const response = await request(app)
        .post('/api/tables/products/columns/category/histogram')
        .send({
          column_type: 'text',
          filters: [
            { type: 'exact', column: 'id', value: 1 }, // Numeric value, not string
            { type: 'exact', column: 'in_stock', value: true } // Boolean value
          ]
        });

      if (response.status !== 200) {
        console.log('Numeric filter histogram error:', response.status, response.body);
      }
      
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      
      // Should filter to only the product with id=1 and in_stock=true
      // In our test data, that's the Laptop Pro in Electronics category
      expect(response.body.length).toBe(1);
      expect(response.body[0].category).toBe('Electronics');
      expect(response.body[0].count).toBe(1);
    });

    it('should handle mixed numeric and string exact filters in table data', async () => {
      // Test that the fix also works for regular table data queries
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: [
            { type: 'exact', column: 'id', value: 2 }, // Numeric value
            { type: 'exact', column: 'category', value: 'Electronics' } // String value
          ]
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(2);
      expect(response.body.data[0].category).toBe('Electronics');
      expect(response.body.data[0].name).toBe('Wireless Mouse');
    });

    it('should handle boolean exact filters without errors', async () => {
      const response = await request(app)
        .post('/api/tables/products/data')
        .send({
          filters: [
            { type: 'exact', column: 'in_stock', value: false } // Boolean value
          ]
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2); // Office Chair and Desk Lamp
      
      response.body.data.forEach((product: any) => {
        expect(product.in_stock).toBe(false);
      });
    });

    it('should handle numeric filter values in discrete histograms (string vs number comparison)', async () => {
      // This tests the specific bug where numeric filter values weren't matching string histogram values
      const response = await request(app)
        .post('/api/tables/products/columns/id/histogram')
        .send({
          column_type: 'integer',
          filters: [
            { type: 'exact', column: 'id', value: 1 } // Numeric value that should match
          ]
        })
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1); // Should show only the filtered ID
      expect(response.body[0].id).toBe(1);
      expect(typeof response.body[0].count).toBe('number');
    });
  });

  describe('CTE and IN filter functionality', () => {
    beforeAll(async () => {
      // Insert sample data for CTE testing
      await runQuery(`
        INSERT INTO test_customers VALUES
        (101, 'John Doe', 'john@example.com'),
        (102, 'Jane Smith', 'jane@example.com'),
        (103, 'Bob Wilson', 'bob@example.com')
      `);

      await runQuery(`
        INSERT INTO test_orders VALUES
        (201, 101, '2024-01-15', 1500.00),
        (202, 102, '2024-01-16', 800.00),
        (203, 101, '2024-01-17', 2200.00),
        (204, 103, '2024-01-18', 950.00)
      `);
    });

    it('should handle POST request with CTE steps and IN filters', async () => {
      // Test the API endpoint with the new query structure
      const response = await request(app)
        .post('/api/tables/test_orders/data')
        .send({
          steps: [
            {
              name: 'filtered_customers',
              tableName: 'test_customers',
              filters: [
                { type: 'exact', column: 'name', value: 'John Doe' }
              ],
              selectColumn: 'customer_id'
            }
          ],
          filters: [
            { type: 'in', column: 'customer_id', stepName: 'filtered_customers', stepColumn: 'customer_id' }
          ]
        });

      if (response.status !== 200) {
        console.log('CTE API Error response:', response.status, response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2); // John Doe has 2 orders
      
      response.body.data.forEach((order: any) => {
        expect(order.customer_id).toBe(101);
      });
    });

    it('should generate correct SQL for multiple steps and complex IN filter', async () => {
      // Test with empty filter in step to see if basic CTE works
      const response = await request(app)
        .post('/api/tables/test_orders/data')
        .send({
          steps: [
            {
              name: 'all_customers',
              tableName: 'test_customers',
              filters: [],
              selectColumn: 'customer_id'
            }
          ],
          filters: [
            { type: 'in', column: 'customer_id', stepName: 'all_customers', stepColumn: 'customer_id' }
          ]
        });

      if (response.status !== 200) {
        console.log('CTE All Customers Error:', response.status, response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(4); // All orders
    });

    it('should combine regular filters with CTE IN filters', async () => {
      // Test combining exact filters with IN filters
      const response = await request(app)
        .post('/api/tables/test_orders/data')
        .send({
          steps: [
            {
              name: 'premium_customers',
              tableName: 'test_customers',
              filters: [
                { type: 'exact', column: 'name', value: 'John Doe' }
              ],
              selectColumn: 'customer_id'
            }
          ],
          filters: [
            { type: 'in', column: 'customer_id', stepName: 'premium_customers', stepColumn: 'customer_id' },
            { type: 'range', column: 'total_amount', min: 1000, max: 3000 }
          ]
        });

      if (response.status !== 200) {
        console.log('Combined Filter Error:', response.status, response.body);
      }

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2); // John's orders between 1000-3000
      
      response.body.data.forEach((order: any) => {
        expect(order.customer_id).toBe(101);
        expect(order.total_amount).toBeGreaterThanOrEqual(1000);
        expect(order.total_amount).toBeLessThanOrEqual(3000);
      });
    });
  });
});