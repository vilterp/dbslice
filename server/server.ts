import express, { Request, Response } from 'express';
import cors from 'cors';
import * as duckdb from 'duckdb';
import * as path from 'path';
import { requestLogger, timeoutMiddleware } from './middleware';
import { Config } from './config';
import { 
  createQueryRunner,
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



// Create server function that accepts a database connection and config
export function createServer(db: duckdb.Database, config: Config) {
  // Create query runner with shared connection and queuing
  const runQuery = createQueryRunner(db);

  // Create Express app
  const app = express();

  app.use(requestLogger);
  app.use(cors());
  app.use(express.json());
  app.use(timeoutMiddleware);

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
      const { column_type = 'text', filters = {}, rangeFilters = {}, top_n = 5, bins = 20 } = req.body;
      
      
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
        const numBins = Math.max(1, Math.min(bins, 100)); // Limit between 1 and 100 bins
        histogram = transformNumericalHistogramResults(rawHistogram, numBins);
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