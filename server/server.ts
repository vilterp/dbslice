import express, { Request, Response } from 'express';
import cors from 'cors';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import logger from './logger';

// Configuration interface  
export interface Config {
  database: {
    path?: string;
    type: 'file' | 'memory' | 's3';
    tables?: { [key: string]: string | { url: string; no_histogram?: string[] } };
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
  buildHistogramWhereClause,
  isNumericalColumnType,
  buildNumericalHistogramQuery,
  buildCategoricalHistogramQuery,
  transformNumericalHistogramResults,
  transformCategoricalHistogramResults
} from './query';

// Request logging middleware
function requestLogger(req: Request, res: Response, next: Function) {
  const startTime = Date.now();
  
  logger.info(`${req.method} ${req.path} - Request started`);
  
  // Override res.end to capture when the response finishes
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any): any {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    
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
    
    logger.info(`Using config file: ${path.basename(resolvedConfigPath)}`);
    if (config.database.type === 's3') {
      logger.info(`Using S3 database with ${Object.keys(config.database.tables || {}).length} table(s)`);
    } else if (config.database.path) {
      logger.info(`Loading DuckDB from: ${config.database.path}`);
    }
    
    return config;
  } catch (error) {
    logger.error('Error loading config file:', (error as Error).message);
    logger.info('Using default in-memory database');
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
      logger.info(`Connected to DuckDB file: ${config.database.path}`);
      return db;
    } else {
      logger.error(`DuckDB file not found: ${config.database.path}`);
      logger.info('Falling back to in-memory database');
      return new duckdb.Database(':memory:');
    }
  } else if (config.database.type === 's3') {
    // For S3, use in-memory database and create views
    const db = new duckdb.Database(':memory:');
    logger.info('Setting up S3 database connection');
    
    // Set up S3 authentication
    const s3SecretQuery = `CREATE SECRET secret2 (
      TYPE s3,
      PROVIDER credential_chain,
      REGION 'us-east-1'
    )`;
    logger.info('Executing S3 secret creation', { query: s3SecretQuery });
    db.exec(s3SecretQuery, (err) => {
      if (err) {
        logger.error('Error creating S3 secret:', err.message);
      } else {
        logger.info('S3 authentication configured');
      }
    });
    
    // Create views for S3 tables
    if (config.database.tables) {
      for (const [tableName, tableConfig] of Object.entries(config.database.tables)) {
        const s3Path = typeof tableConfig === 'string' ? tableConfig : tableConfig.url;
        const viewQuery = `CREATE VIEW ${tableName} AS SELECT * FROM '${s3Path}'`;
        logger.info('Creating S3 view', { tableName, query: viewQuery });
        db.exec(viewQuery, (err) => {
          if (err) {
            logger.error(`Error creating view ${tableName}:`, err.message);
          } else {
            logger.info(`Created S3 view: ${tableName}`);
          }
        });
      }
    }
    return db;
  } else {
    const db = new duckdb.Database(':memory:');
    logger.info('Using in-memory database');
    return db;
  }
}

// Create server function that accepts a database connection and config
export function createServer(db: duckdb.Database, config: Config) {
  // Create a shared connection for better caching and performance
  const sharedConnection = new duckdb.Connection(db);
  
  // Query queue to serialize queries on the shared connection
  const queryQueue: Array<() => void> = [];
  let isProcessingQuery = false;
  
  const processQueryQueue = () => {
    if (isProcessingQuery || queryQueue.length === 0) return;
    
    isProcessingQuery = true;
    const nextQuery = queryQueue.shift();
    if (nextQuery) {
      nextQuery();
    }
  };
  
  // Promisified query function using the shared connection with queuing
  const runQuery = (query: string, params: any[] = []): Promise<any[]> => {
    const startTime = Date.now();
    const queryId = Math.random().toString(36).substring(2, 8); // Generate short unique ID
    
    // Log when the query starts
    logger.info('SQL query started', { 
      queryId,
      query: query.trim(),
      params: params.length > 0 ? params : undefined
    });
    
    return new Promise((resolve, reject) => {
      const executeQuery = () => {
        if (params.length === 0) {
          sharedConnection.all(query, (err: Error | null, rows: any[]) => {
            isProcessingQuery = false;
            const duration = Date.now() - startTime;
            
            if (err) {
              logger.error('SQL query failed', { 
                queryId,
                query: query.trim(),
                params: params.length > 0 ? params : undefined,
                error: err.message,
                duration: `${duration}ms`
              });
              reject(err);
            } else {
              logger.info('SQL query finished', { 
                queryId,
                query: query.trim(),
                rowCount: rows?.length || 0,
                duration: `${duration}ms`
              });
              resolve(sanitizeQueryResult(rows || []));
            }
            
            // Process next query in queue
            processQueryQueue();
          });
        } else {
          sharedConnection.all(query, params, (err: Error | null, rows: any[]) => {
            isProcessingQuery = false;
            const duration = Date.now() - startTime;
            
            if (err) {
              logger.error('SQL query failed', { 
                queryId,
                query: query.trim(),
                params,
                error: err.message,
                duration: `${duration}ms`
              });
              reject(err);
            } else {
              logger.info('SQL query finished', { 
                queryId,
                query: query.trim(),
                rowCount: rows?.length || 0,
                duration: `${duration}ms`
              });
              resolve(sanitizeQueryResult(rows || []));
            }
            
            // Process next query in queue
            processQueryQueue();
          });
        }
      };
      
      // Add query to queue
      queryQueue.push(executeQuery);
      processQueryQueue();
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
      
      // Add no_histogram information from config
      const noHistogramColumns = new Set<string>();
      if (config.database.tables && config.database.tables[tableName]) {
        const tableConfig = config.database.tables[tableName];
        if (typeof tableConfig === 'object' && tableConfig.no_histogram) {
          tableConfig.no_histogram.forEach(col => noHistogramColumns.add(col));
        }
      }
      
      // Add no_histogram flag to each column
      const enhancedColumns = columns.map((column: any) => ({
        ...column,
        no_histogram: noHistogramColumns.has(column.column_name)
      }));
      
      res.json(enhancedColumns);
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
      const { column_type = 'text', filters = {}, rangeFilters = {}, top_n = 5 } = req.body;
      
      
      // Build WHERE clause for histogram using the direct filters from request body
      const { whereClause } = buildHistogramWhereClause(filters, rangeFilters, columnName);
      
      let histogram: any[];
      const columnTypeStr = column_type as string;
      
      // Check if column is numerical for binning
      const isNumerical = isNumericalColumnType(columnTypeStr);
      
      if (isNumerical) {
        // For numerical columns, use DuckDB's automatic histogram binning
        const histogramQuery = buildNumericalHistogramQuery(tableName, columnName, whereClause);
        const rawHistogram = await runQuery(histogramQuery);
        histogram = transformNumericalHistogramResults(rawHistogram);
      } else {
        // For categorical columns, use simple GROUP BY COUNT
        // Get top N categories plus calculate "others"
        const topLimit = Math.max(1, Math.min(top_n, 20)); // Limit between 1 and 20
        const histogramQuery = buildCategoricalHistogramQuery(tableName, columnName, whereClause, topLimit + 1);
        const rawHistogram = await runQuery(histogramQuery);
        histogram = await transformCategoricalHistogramResults(rawHistogram, topLimit, tableName, columnName, whereClause, runQuery);
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