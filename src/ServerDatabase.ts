import * as duckdb from 'duckdb';
import { Database } from './database';
import { BaseDuckDBDatabase } from './BaseDuckDBDatabase';
import { 
  Column, 
  Query, 
  HistogramQuery, 
  TableDataResponse, 
  HistogramResult 
} from './types';
import { 
  createQueryRunner
} from '../server/query';
import { sanitizeIdentifier } from '../server/sanitize';
import { Config } from '../server/config';

export class ServerDatabase extends BaseDuckDBDatabase implements Database {
  private runSQLQuery: (sql: string, params?: any[]) => Promise<any[]>;
  private config: Config;

  constructor(db: duckdb.Database, config: Config) {
    super();
    this.runSQLQuery = createQueryRunner(db);
    this.config = config;
  }

  protected async executeQuery(sql: string): Promise<any[]> {
    return await this.runSQLQuery(sql);
  }

  protected shouldSkipHistogram(tableName: string, columnName: string): boolean {
    // Check config for no_histogram restrictions
    const noHistogramColumns = new Set<string>();
    if (this.config.database.tables && this.config.database.tables[tableName]) {
      const tableConfig = this.config.database.tables[tableName];
      if (typeof tableConfig === 'object' && tableConfig.no_histogram) {
        tableConfig.no_histogram.forEach(col => noHistogramColumns.add(col));
      }
    }
    return noHistogramColumns.has(columnName);
  }

  async getTableData(query: Query): Promise<TableDataResponse> {
    // Enforce config limits
    const limitedQuery: Query = {
      ...query,
      limit: Math.min(query.limit || this.config.api.maxRows, this.config.api.maxRows)
    };
    
    const { sql, countSql } = this.buildQuerySQL(limitedQuery);
    
    // Execute data query
    const data = await this.executeQuery(sql);
    
    // Execute count query  
    const countResult = await this.executeQuery(countSql);
    const total = countResult[0]?.total || 0;

    return { data, total };
  }

  async getHistogram(histogramQuery: HistogramQuery): Promise<HistogramResult> {
    try {
      const { sql } = this.buildHistogramSQL(histogramQuery);
      const data = await this.executeQuery(sql);
      return { 
        data: data, 
        isEmpty: data.length === 0 
      };
    } catch (error) {
      return { 
        data: [], 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  async getInfo(): Promise<{
    database: {
      path?: string;
      type?: string;
      tables: number;
    };
    config: {
      maxRows: number;
      maxHistogramBins?: number;
    };
  }> {
    const tables = await this.runSQLQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
    `);
    
    return {
      database: {
        path: this.config.database.path,
        type: this.config.database.type,
        tables: tables.length
      },
      config: {
        maxRows: this.config.api.maxRows,
        maxHistogramBins: this.config.api.maxHistogramBins
      }
    };
  }
}