import { Database } from './database';
import { 
  Table, 
  Column, 
  Query, 
  HistogramQuery, 
  TableDataResponse, 
  HistogramResult,
  NUMERICAL_COLUMN_TYPES
} from './types';

import * as duckdb from '@duckdb/duckdb-wasm';

export class WasmDatabase implements Database {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized: boolean = false;

  constructor() {
    // Database will be initialized when first method is called
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize DuckDB WASM
      const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
        mvp: {
          mainModule: '/duckdb-mvp.wasm',
          mainWorker: '/duckdb-browser-mvp.worker.js',
        },
        eh: {
          mainModule: '/duckdb-eh.wasm',
          mainWorker: '/duckdb-browser-eh.worker.js',
        },
      };

      // Select a bundle based on browser capabilities
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      
      // Instantiate the async version of DuckDB-wasm
      const worker = new Worker(bundle.mainWorker!);
      const logger = new duckdb.ConsoleLogger();
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule);
      
      // Create connection
      this.conn = await this.db.connect();
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize DuckDB WASM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadFile(file: File): Promise<void> {
    await this.ensureInitialized();
    
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    
    // Register the file with DuckDB WASM
    await this.db!.registerFileBuffer(file.name, new Uint8Array(buffer));
    
    // Attach the database file
    await this.conn!.query(`ATTACH '${file.name}' AS main`);
  }

  async getTables(): Promise<Table[]> {
    await this.ensureInitialized();
    
    const result = await this.conn!.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'main'
    `);
    
    const tables: Table[] = [];
    for (let i = 0; i < result.numRows; i++) {
      tables.push({ table_name: result.get(i)?.table_name });
    }
    return tables;
  }

  async getColumns(tableName: string): Promise<Column[]> {
    await this.ensureInitialized();
    
    const result = await this.conn!.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${this.sanitizeIdentifier(tableName)}'
    `);
    
    // Get foreign key information (if available in WASM version)
    let foreignKeys: any[] = [];
    let reverseForeignKeys: any[] = [];
    
    try {
      const fkResult = await this.conn.query(`
        SELECT constraint_column_names, referenced_table, referenced_column_names
        FROM duckdb_constraints 
        WHERE table_name = '${this.sanitizeIdentifier(tableName)}' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      foreignKeys = fkResult.toArray();
      
      const rfkResult = await this.conn.query(`
        SELECT constraint_column_names, table_name as source_table, referenced_column_names
        FROM duckdb_constraints 
        WHERE referenced_table = '${this.sanitizeIdentifier(tableName)}' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      reverseForeignKeys = rfkResult.toArray();
    } catch {
      // Foreign key constraints might not be available in all DuckDB WASM versions
    }
    
    const columns = result.toArray();
    
    // Create foreign key mappings
    const foreignKeyMap = new Map<string, { referenced_table: string; referenced_column: string }>();
    foreignKeys.forEach((fk: any) => {
      const columnName = Array.isArray(fk.constraint_column_names) ? fk.constraint_column_names[0] : fk.constraint_column_names;
      const referencedTable = fk.referenced_table;
      const referencedColumn = Array.isArray(fk.referenced_column_names) ? fk.referenced_column_names[0] : fk.referenced_column_names;
      
      foreignKeyMap.set(columnName, {
        referenced_table: referencedTable,
        referenced_column: referencedColumn
      });
    });

    const reverseForeignKeyMap = new Map<string, { source_table: string; source_column: string }[]>();
    reverseForeignKeys.forEach((rfk: any) => {
      const referencedColumn = Array.isArray(rfk.referenced_column_names) ? rfk.referenced_column_names[0] : rfk.referenced_column_names;
      const sourceTable = rfk.source_table;
      const sourceColumn = Array.isArray(rfk.constraint_column_names) ? rfk.constraint_column_names[0] : rfk.constraint_column_names;
      
      if (!reverseForeignKeyMap.has(referencedColumn)) {
        reverseForeignKeyMap.set(referencedColumn, []);
      }
      reverseForeignKeyMap.get(referencedColumn)!.push({
        source_table: sourceTable,
        source_column: sourceColumn
      });
    });
    
    return columns.map((column: any) => ({
      column_name: column.column_name,
      data_type: column.data_type,
      no_histogram: false, // WASM version doesn't have config restrictions
      foreign_key: foreignKeyMap.get(column.column_name),
      reverse_foreign_keys: reverseForeignKeyMap.get(column.column_name)
    }));
  }

  async getTableData(query: Query): Promise<TableDataResponse> {
    await this.ensureInitialized();
    
    const { sql, countSql } = this.buildQuerySQL(query);
    
    // Execute data query
    const result = await this.conn.query(sql);
    const data = result.toArray();
    
    // Execute count query
    const countResult = await this.conn.query(countSql);
    const total = countResult.toArray()[0]?.total || 0;
    
    return { data, total };
  }

  async getHistogram(histogramQuery: HistogramQuery): Promise<HistogramResult> {
    await this.ensureInitialized();
    
    try {
      const { sql } = this.buildHistogramSQL(histogramQuery);
      const result = await this.conn.query(sql);
      const data = result.toArray();
      
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
    await this.ensureInitialized();
    
    const tables = await this.getTables();
    
    return {
      database: {
        type: 'wasm',
        tables: tables.length
      },
      config: {
        maxRows: 10000, // Higher limit for WASM since it's client-side
        maxHistogramBins: 100
      }
    };
  }

  private sanitizeIdentifier(identifier: string): string {
    // Basic sanitization - in production you'd want more robust sanitization
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }

  private buildQuerySQL(query: Query): { sql: string; countSql: string } {
    const { tableName, filters = [], orderBy, orderDir = 'ASC', limit, offset, steps = [] } = query;
    
    const sanitizedTableName = this.sanitizeIdentifier(tableName);
    
    // Build CTE clauses if steps exist
    const cteClause = this.buildCTEClause(steps);
    
    // Build WHERE clause
    const whereClause = this.buildWhereClause(filters);
    
    // Build ORDER BY clause
    let orderByClause = '';
    if (orderBy) {
      const sanitizedOrderBy = this.sanitizeIdentifier(orderBy);
      const dir = orderDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      orderByClause = ` ORDER BY ${sanitizedOrderBy} ${dir}`;
    }
    
    // Build LIMIT clause
    let limitClause = '';
    if (limit !== undefined) {
      limitClause = ` LIMIT ${limit}`;
      if (offset !== undefined) {
        limitClause += ` OFFSET ${offset}`;
      }
    }
    
    const sql = `${cteClause}SELECT * FROM ${sanitizedTableName}${whereClause}${orderByClause}${limitClause}`;
    const countSql = `${cteClause}SELECT COUNT(*) as total FROM ${sanitizedTableName}${whereClause}`;
    
    return { sql, countSql };
  }

  private buildHistogramSQL(histogramQuery: HistogramQuery): { sql: string } {
    const { tableName, columnName, columnType, filters = [], topN = 5, bins = 20 } = histogramQuery;
    
    const sanitizedTableName = this.sanitizeIdentifier(tableName);
    const sanitizedColumnName = this.sanitizeIdentifier(columnName);
    
    // Build WHERE clause excluding the histogram column
    const whereClause = this.buildWhereClause(filters.filter(f => f.column !== columnName));
    
    const isNumerical = NUMERICAL_COLUMN_TYPES.some(type => 
      columnType.toUpperCase().includes(type)
    );
    
    let sql: string;
    
    if (isNumerical) {
      // For numerical columns, use DuckDB's histogram function
      sql = `
        SELECT 
          unnest(map_keys(histogram(${sanitizedColumnName}))) as bin_value,
          unnest(map_values(histogram(${sanitizedColumnName}))) as count
        FROM ${sanitizedTableName}
        ${whereClause}
      `;
    } else {
      // For categorical columns
      sql = `
        SELECT 
          ${sanitizedColumnName},
          COUNT(*) as count
        FROM ${sanitizedTableName}
        ${whereClause}
        GROUP BY ${sanitizedColumnName}
        ORDER BY count DESC, ${sanitizedColumnName} ASC
        LIMIT ${Math.max(1, Math.min(topN + 1, 20))}
      `;
    }
    
    return { sql };
  }

  private buildWhereClause(filters: any[]): string {
    if (filters.length === 0) return '';
    
    const conditions: string[] = [];
    
    for (const filter of filters) {
      switch (filter.type) {
        case 'exact':
          const sanitizedValue = typeof filter.value === 'string' 
            ? `'${filter.value.replace(/'/g, "''")}'` 
            : filter.value;
          conditions.push(`${this.sanitizeIdentifier(filter.column)} = ${sanitizedValue}`);
          break;
        case 'range':
          conditions.push(`${this.sanitizeIdentifier(filter.column)} BETWEEN ${filter.min} AND ${filter.max}`);
          break;
        case 'in':
          conditions.push(`${this.sanitizeIdentifier(filter.column)} IN (SELECT ${this.sanitizeIdentifier(filter.stepColumn)} FROM ${this.sanitizeIdentifier(filter.stepName)})`);
          break;
      }
    }
    
    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  }

  private buildCTEClause(steps: any[]): string {
    if (steps.length === 0) return '';
    
    const cteStatements: string[] = [];
    
    for (const step of steps) {
      const sanitizedTableName = this.sanitizeIdentifier(step.tableName);
      const sanitizedStepName = this.sanitizeIdentifier(step.name);
      const whereClause = this.buildWhereClause(step.filters);
      
      const selectClause = step.selectColumn ? this.sanitizeIdentifier(step.selectColumn) : '*';
      cteStatements.push(`${sanitizedStepName} AS (SELECT ${selectClause} FROM ${sanitizedTableName}${whereClause})`);
    }
    
    return `WITH ${cteStatements.join(', ')} `;
  }
}