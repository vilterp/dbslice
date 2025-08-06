import express, { Request, Response } from 'express';
import cors from 'cors';
import * as duckdb from 'duckdb';
import * as path from 'path';
import { requestLogger, timeoutMiddleware, errorHandler } from './middleware';
import { Config } from './config';
import { 
  createQueryRunner,
  runQuery,
  runCountQuery,
  runHistogramQuery
} from './query';
import { sanitizeIdentifier } from './sanitize';
import { Query, HistogramQuery, Filter } from '../src/types';
import logger from './logger';



// Create server function that accepts a database connection and config
export function createServer(db: duckdb.Database, config: Config) {
  // Create query runner with shared connection and queuing
  const runSQLQuery = createQueryRunner(db);

  // Create Express app
  const app = express();

  app.use(requestLogger);
  app.use(cors());
  app.use(express.json());
  app.use(timeoutMiddleware);

  // Get all tables
  app.get('/api/tables', async (_req: Request, res: Response) => {
    try {
      const tables = await runSQLQuery(`
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
      const columns = await runSQLQuery(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${sanitizedTableName}'
      `);
      
      // Get foreign key information for this table (outward references)
      const foreignKeys = await runSQLQuery(`
        SELECT constraint_column_names, referenced_table, referenced_column_names
        FROM duckdb_constraints 
        WHERE table_name = '${sanitizedTableName}' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      
      // Get reverse foreign key information (inward references)
      const reverseForeignKeys = await runSQLQuery(`
        SELECT constraint_column_names, table_name as source_table, referenced_column_names
        FROM duckdb_constraints 
        WHERE referenced_table = '${sanitizedTableName}' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      
      // Create foreign key mapping
      const foreignKeyMap = new Map<string, { referenced_table: string; referenced_column: string }>();
      foreignKeys.forEach((fk: any) => {
        // DuckDB returns arrays for these fields
        const columnName = fk.constraint_column_names[0];
        const referencedTable = fk.referenced_table;
        const referencedColumn = fk.referenced_column_names[0];
        
        foreignKeyMap.set(columnName, {
          referenced_table: referencedTable,
          referenced_column: referencedColumn
        });
      });

      // Create reverse foreign key mapping
      const reverseForeignKeyMap = new Map<string, { source_table: string; source_column: string }[]>();
      reverseForeignKeys.forEach((rfk: any) => {
        // Column that is being referenced in this table
        const referencedColumn = rfk.referenced_column_names[0];
        const sourceTable = rfk.source_table;
        const sourceColumn = rfk.constraint_column_names[0];
        
        if (!reverseForeignKeyMap.has(referencedColumn)) {
          reverseForeignKeyMap.set(referencedColumn, []);
        }
        reverseForeignKeyMap.get(referencedColumn)!.push({
          source_table: sourceTable,
          source_column: sourceColumn
        });
      });
      
      // Add no_histogram information from config
      const noHistogramColumns = new Set<string>();
      if (config.database.tables && config.database.tables[tableName]) {
        const tableConfig = config.database.tables[tableName];
        if (typeof tableConfig === 'object' && tableConfig.no_histogram) {
          tableConfig.no_histogram.forEach(col => noHistogramColumns.add(col));
        }
      }
      
      // Add no_histogram flag and foreign key info to each column
      const enhancedColumns = columns.map((column: any) => ({
        ...column,
        no_histogram: noHistogramColumns.has(column.column_name),
        foreign_key: foreignKeyMap.get(column.column_name),
        reverse_foreign_keys: reverseForeignKeyMap.get(column.column_name)
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
      const { 
        filters = {}, 
        rangeFilters = {}, 
        limit = config.api.maxRows, 
        offset = 0, 
        orderBy, 
        orderDir,
        steps = [] // New parameter for CTE steps
      } = req.body;
      
      let unifiedFilters: Filter[] = [];
      
      // If req.body.filters is already an array (new format), use it directly
      if (Array.isArray(req.body.filters)) {
        unifiedFilters = req.body.filters;
      } else {
        // Convert old filter format to unified filters array
        // Add exact filters
        for (const [column, value] of Object.entries(filters)) {
          unifiedFilters.push({
            type: 'exact',
            column,
            value: String(value)
          });
        }
        
        // Add range filters
        for (const [column, rangeFilter] of Object.entries(rangeFilters)) {
          const rf = rangeFilter as { min: number; max: number };
          unifiedFilters.push({
            type: 'range',
            column,
            min: rf.min,
            max: rf.max
          });
        }
      }
      
      // Create Query object
      const query: Query = {
        tableName,
        filters: unifiedFilters,
        orderBy,
        orderDir: orderDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
        limit: Math.min(limit as number, config.api.maxRows),
        offset: offset as number,
        steps: steps // Include CTE steps
      };
      
      try {
        // Get paginated data using new runQuery function
        const data = await runQuery(query, runSQLQuery);

        // Get total count using new runCountQuery function
        const countQuery: Query = {
          tableName,
          filters: unifiedFilters,
          steps: steps
        };
        const total = await runCountQuery(countQuery, runSQLQuery);

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
      const { 
        column_type = 'text', 
        filters = [], 
        steps = [], 
        top_n = 5, 
        bins = 20
      } = req.body;
      
      // Create HistogramQuery object
      const histogramQuery: HistogramQuery = {
        tableName,
        filters,
        steps,
        columnName,
        columnType: column_type as string,
        topN: top_n,
        bins
      };
      
      // Execute histogram query using new consolidated function
      const histogram = await runHistogramQuery(histogramQuery, runSQLQuery);
      
      res.json(histogram);
    } catch (error) {
      logger.error('Histogram query failed', {
        method: req.method,
        path: req.path,
        tableName: req.params.tableName,
        columnName: req.params.columnName,
        filters: req.body.filters,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get database info endpoint
  app.get('/api/info', async (_req: Request, res: Response) => {
    try {
      const tables = await runSQLQuery(`
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

  // Add global error handler (must be last)
  app.use(errorHandler);

  // Return app and runQuery for testing
  return { app, runQuery: runSQLQuery };
}