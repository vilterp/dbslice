import express, { Request, Response } from 'express';
import cors from 'cors';
import * as duckdb from 'duckdb';
import * as path from 'path';
import { requestLogger, timeoutMiddleware, errorHandler } from './middleware';
import { Config } from './config';
import { ServerDatabase } from '../src/ServerDatabase';
import { Query, HistogramQuery, Filter } from '../src/types';
import logger from './logger';



// Create server function that accepts a database connection and config
export function createServer(db: duckdb.Database, config: Config) {
  // Create ServerDatabase instance
  const serverDb = new ServerDatabase(db, config);

  // Create Express app
  const app = express();

  app.use(requestLogger);
  app.use(cors());
  app.use(express.json());
  app.use(timeoutMiddleware);

  // Get all tables
  app.get('/api/tables', async (_req: Request, res: Response) => {
    try {
      const tables = await serverDb.getTables();
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get columns for a table
  app.get('/api/tables/:tableName/columns', async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const columns = await serverDb.getColumns(tableName);
      res.json(columns);
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
      
      const result = await serverDb.getTableData(query);
      res.json(result);
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
      
      const result = await serverDb.getHistogram(histogramQuery);
      
      if (result.error) {
        res.status(500).json({ error: result.error });
      } else {
        res.json(result.data);
      }
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
      const info = await serverDb.getInfo();
      res.json(info);
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

  // Return app and serverDb for testing
  return { app, serverDb };
}