import express, { Request, Response } from 'express';
import cors from 'cors';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Configuration interface  
export interface Config {
  database: {
    path?: string;
    type: 'file' | 'memory' | 's3';
    tables?: { [key: string]: string };
  };
  server: {
    port: number;
    host: string;
  };
  api: {
    maxRows: number;
    maxHistogramBins: number;
  };
}

// Utility function to convert BigInt values to numbers for JSON serialization
const sanitizeQueryResult = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeQueryResult);
  } else if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = typeof value === 'bigint' ? Number(value) : sanitizeQueryResult(value);
    }
    return sanitized;
  } else if (typeof data === 'bigint') {
    return Number(data);
  }
  return data;
};

// Import query building utilities
import { 
  sanitizeIdentifier, 
  buildWhereClause, 
  buildOrderByClause,
  parseHistogramFilters,
  buildHistogramWhereClause
} from './query';

// Request logging middleware
function requestLogger(req: Request, res: Response, next: Function) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`🚀 [${timestamp}] ${req.method} ${req.path} - Request started`);
  
  // Override res.end to capture when the response finishes
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any): any {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const finishTimestamp = new Date().toISOString();
    
    console.log(`✅ [${finishTimestamp}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    
    // Call the original end method with proper arguments
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
}

// Configuration loading function
export function loadConfig(configPath?: string): Config {
  try {
    let resolvedConfigPath: string;
    
    if (configPath) {
      // Use provided config path
      resolvedConfigPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
    } else {
      // Try YAML first, then fallback to JSON for backward compatibility
      resolvedConfigPath = path.join(__dirname, '../config.yaml');
      if (!fs.existsSync(resolvedConfigPath)) {
        resolvedConfigPath = path.join(__dirname, '../config.json');
      }
    }
    
    const configData = fs.readFileSync(resolvedConfigPath, 'utf8');
    
    let config: Config;
    if (resolvedConfigPath.endsWith('.yaml') || resolvedConfigPath.endsWith('.yml')) {
      config = yaml.load(configData) as Config;
    } else {
      config = JSON.parse(configData);
    }
    
    console.log(`⚙️  Using config file: ${path.basename(resolvedConfigPath)}`);
    if (config.database.type === 's3') {
      console.log(`☁️  Using S3 database with ${Object.keys(config.database.tables || {}).length} table(s)`);
    } else if (config.database.path) {
      console.log(`📁 Loading DuckDB from: ${config.database.path}`);
    }
    
    return config;
  } catch (error) {
    console.error('❌ Error loading config file:', (error as Error).message);
    console.log('📝 Using default in-memory database');
    return {
      database: { path: ':memory:', type: 'memory' },
      server: { port: 3001, host: 'localhost' },
      api: { maxRows: 1000, maxHistogramBins: 50 }
    };
  }
}

// Database initialization function
export function initializeDatabase(config: Config): duckdb.Database {
  if (config.database.type === 'file' && config.database.path && config.database.path !== ':memory:') {
    // Check if file exists
    if (fs.existsSync(config.database.path)) {
      const db = new duckdb.Database(config.database.path);
      console.log(`✅ Connected to DuckDB file: ${config.database.path}`);
      return db;
    } else {
      console.error(`❌ DuckDB file not found: ${config.database.path}`);
      console.log('📝 Falling back to in-memory database');
      return new duckdb.Database(':memory:');
    }
  } else if (config.database.type === 's3') {
    // For S3, use in-memory database and create views
    const db = new duckdb.Database(':memory:');
    console.log('☁️  Setting up S3 database connection');
    
    // Set up S3 authentication
    db.exec(`CREATE SECRET secret2 (
      TYPE s3,
      PROVIDER credential_chain,
      REGION 'us-east-1'
    )`, (err) => {
      if (err) {
        console.error('❌ Error creating S3 secret:', err.message);
      } else {
        console.log('✅ S3 authentication configured');
      }
    });
    
    // Create views for S3 tables
    if (config.database.tables) {
      for (const [tableName, s3Path] of Object.entries(config.database.tables)) {
        const viewQuery = `CREATE VIEW ${tableName} AS SELECT * FROM '${s3Path}'`;
        db.exec(viewQuery, (err) => {
          if (err) {
            console.error(`❌ Error creating view ${tableName}:`, err.message);
          } else {
            console.log(`✅ Created S3 view: ${tableName}`);
          }
        });
      }
    }
    return db;
  } else {
    const db = new duckdb.Database(':memory:');
    console.log('📝 Using in-memory database');
    return db;
  }
}

// Create server function that accepts a database connection and config
export function createServer(db: duckdb.Database, config: Config) {
  // Promisified query function using the passed database connection
  const runQuery = (query: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (params.length === 0) {
        db.all(query, (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(sanitizeQueryResult(rows || []));
          }
        });
      } else {
        db.all(query, params, (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(sanitizeQueryResult(rows || []));
          }
        });
      }
    });
  };

  // Create Express app
  const app = express();

  app.use(requestLogger);
  app.use(cors());
  app.use(express.json());

  // Get all tables
  app.get('/api/tables', async (_req: Request, res: Response) => {
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
  app.get('/api/tables/:tableName/columns', async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      // Sanitize table name to prevent SQL injection
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
  app.post('/api/tables/:tableName/data', async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const { filters = {}, rangeFilters = {}, limit = config.api.maxRows, offset = 0, orderBy, orderDir } = req.body;
      
      // Sanitize table name
      const sanitizedTableName = sanitizeIdentifier(tableName);
      
      // Build WHERE clause using query utilities
      const whereClause = buildWhereClause(filters, rangeFilters);
      const baseQuery = `FROM ${sanitizedTableName}${whereClause}`;
      
      // Build ORDER BY clause
      const orderClause = buildOrderByClause(orderBy, orderDir);

      // Query for paginated data
      const limitValue = Math.min(limit as number, config.api.maxRows);
      const dataQuery = `SELECT * ${baseQuery}${orderClause} LIMIT ${limitValue} OFFSET ${offset}`;
      
      try {
        const data = await runQuery(dataQuery);

        // Query for total count (without LIMIT/OFFSET)
        const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
        const countResult = await runQuery(countQuery);
        const total = countResult[0]?.total ?? 0;

        res.json({ data, total });
      } catch (queryError) {
        throw queryError;
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get histogram data for a column
  app.post('/api/tables/:tableName/columns/:columnName/histogram', async (req: Request, res: Response) => {
    try {
      const { tableName, columnName } = req.params;
      const { bins = 20, column_type = 'text', filters = {}, rangeFilters = {} } = req.body;
      
      // Sanitize names
      const sanitizedTableName = sanitizeIdentifier(tableName);
      const sanitizedColumnName = sanitizeIdentifier(columnName);
      
      // Build WHERE clause for histogram using the direct filters from request body
      const { whereClause, params } = buildHistogramWhereClause(filters, rangeFilters, columnName);
      
      let histogram: any[];
      const columnTypeStr = column_type as string;
      
      // Check if column is numerical for binning
      const isNumerical = ['INTEGER', 'BIGINT', 'DECIMAL', 'DOUBLE', 'FLOAT', 'NUMERIC', 'REAL'].some(type => 
        columnTypeStr.toUpperCase().includes(type)
      );
      
      if (isNumerical) {
        // For numerical columns, create binned histogram
        const binsCount = Math.min(Number(bins), 10); // Limit bins for numerical
        
        // Get min/max values for binning
        const rangeQuery = `SELECT MIN(${sanitizedColumnName}) as min_val, MAX(${sanitizedColumnName}) as max_val FROM ${sanitizedTableName}${whereClause}`;
        const rangeResult = await runQuery(rangeQuery);
        
        if (rangeResult.length > 0 && rangeResult[0].min_val !== null && rangeResult[0].max_val !== null) {
          const minVal = Number(rangeResult[0].min_val);
          const maxVal = Number(rangeResult[0].max_val);
          const binWidth = (maxVal - minVal) / binsCount;
          
          // Create binned histogram query
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
            LIMIT 10
          `;
          
          histogram = await runQuery(binQuery);
        } else {
          histogram = [];
        }
      } else {

        // For categorical columns, show top 5 values and number of distinct 'other' values
        const topValuesQuery = `SELECT ${sanitizedColumnName}, COUNT(*) as count FROM ${sanitizedTableName}${whereClause} GROUP BY ${sanitizedColumnName} ORDER BY count DESC, ${sanitizedColumnName} ASC LIMIT 5`;
        const topValues = await runQuery(topValuesQuery);

        // Get all distinct values
        const allDistinctQuery = `SELECT DISTINCT ${sanitizedColumnName} FROM ${sanitizedTableName}${whereClause}`;
        const allDistinct = await runQuery(allDistinctQuery);
        const allDistinctSet = new Set(allDistinct.map(row => row[sanitizedColumnName]));

        // Remove top values from the set to get 'other' distincts
        for (const top of topValues) {
          allDistinctSet.delete(top[sanitizedColumnName]);
        }
        const othersDistinctCount = allDistinctSet.size;

        histogram = [...topValues];

        // Add "others" entry if there are more distinct values
        if (othersDistinctCount > 0) {
          histogram.push({
            [sanitizedColumnName]: '(others)',
            count: othersDistinctCount,
            is_others: true
          });
        }
      }
      
      res.json(histogram);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get database info endpoint
  app.get('/api/info', async (_req: Request, res: Response) => {
    try {
      const tables = await runQuery(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'main'
      `);
      
      res.json({
        database: {
          path: config.database.path,
          type: config.database.type,
          tables: tables.length
        },
        config: {
          maxRows: config.api.maxRows,
          maxHistogramBins: config.api.maxHistogramBins
        }
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/build')));
    
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
    });
  }

  // Return app and runQuery for testing
  return { app, runQuery };
}