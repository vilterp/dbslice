import * as duckdb from 'duckdb';
import { Database } from './database';
import { 
  Table, 
  Column, 
  Query, 
  HistogramQuery, 
  TableDataResponse, 
  HistogramResult 
} from './types';
import { 
  createQueryRunner,
  runQuery,
  runCountQuery,
  runHistogramQuery
} from '../server/query';
import { sanitizeIdentifier } from '../server/sanitize';
import { Config } from '../server/config';

export class ServerDatabase implements Database {
  private runSQLQuery: (sql: string, params?: any[]) => Promise<any[]>;
  private config: Config;

  constructor(db: duckdb.Database, config: Config) {
    this.runSQLQuery = createQueryRunner(db);
    this.config = config;
  }

  async getTables(): Promise<Table[]> {
    return await this.runSQLQuery(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
    `);
  }

  async getColumns(tableName: string): Promise<Column[]> {
    const sanitizedTableName = sanitizeIdentifier(tableName);
    
    const columns = await this.runSQLQuery(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${sanitizedTableName}'
    `);
    
    // Get foreign key information for this table (outward references)
    const foreignKeys = await this.runSQLQuery(`
      SELECT constraint_column_names, referenced_table, referenced_column_names
      FROM duckdb_constraints 
      WHERE table_name = '${sanitizedTableName}' 
      AND constraint_type = 'FOREIGN KEY'
    `);
    
    // Get reverse foreign key information (inward references)
    const reverseForeignKeys = await this.runSQLQuery(`
      SELECT constraint_column_names, table_name as source_table, referenced_column_names
      FROM duckdb_constraints 
      WHERE referenced_table = '${sanitizedTableName}' 
      AND constraint_type = 'FOREIGN KEY'
    `);
    
    // Create foreign key mapping
    const foreignKeyMap = new Map<string, { referenced_table: string; referenced_column: string }>();
    foreignKeys.forEach((fk: any) => {
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
    if (this.config.database.tables && this.config.database.tables[tableName]) {
      const tableConfig = this.config.database.tables[tableName];
      if (typeof tableConfig === 'object' && tableConfig.no_histogram) {
        tableConfig.no_histogram.forEach(col => noHistogramColumns.add(col));
      }
    }
    
    // Add no_histogram flag and foreign key info to each column
    return columns.map((column: any) => ({
      ...column,
      no_histogram: noHistogramColumns.has(column.column_name),
      foreign_key: foreignKeyMap.get(column.column_name),
      reverse_foreign_keys: reverseForeignKeyMap.get(column.column_name)
    }));
  }

  async getTableData(query: Query): Promise<TableDataResponse> {
    // Enforce config limits
    const limitedQuery: Query = {
      ...query,
      limit: Math.min(query.limit || this.config.api.maxRows, this.config.api.maxRows)
    };
    
    // Get paginated data using runQuery function
    const data = await runQuery(limitedQuery, this.runSQLQuery);

    // Get total count using runCountQuery function
    const countQuery: Query = {
      tableName: query.tableName,
      filters: query.filters,
      steps: query.steps
    };
    const total = await runCountQuery(countQuery, this.runSQLQuery);

    return { data, total };
  }

  async getHistogram(histogramQuery: HistogramQuery): Promise<HistogramResult> {
    try {
      const histogram = await runHistogramQuery(histogramQuery, this.runSQLQuery);
      return { 
        data: histogram, 
        isEmpty: histogram.length === 0 
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