import { Database } from './database';
import { BaseDuckDBDatabase } from './BaseDuckDBDatabase';
import { 
  Column, 
  Query, 
  HistogramQuery, 
  TableDataResponse, 
  HistogramResult
} from './types';

import * as duckdb from '@duckdb/duckdb-wasm';

export class WasmDatabase extends BaseDuckDBDatabase implements Database {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initialized: boolean = false;

  constructor() {
    super();
  }

  protected async executeQuery(sql: string): Promise<any[]> {
    await this.ensureInitialized();
    const result = await this.conn!.query(sql);
    
    const rows: any[] = [];
    for (let i = 0; i < result.numRows; i++) {
      rows.push(result.get(i));
    }
    return rows;
  }

  protected shouldSkipHistogram(tableName: string, columnName: string): boolean {
    // WASM version doesn't have config restrictions, so never skip histograms
    return false;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing DuckDB WASM...');
      
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
      console.log('Selecting DuckDB bundle...');
      const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
      console.log('Selected bundle:', bundle);
      
      // Instantiate the async version of DuckDB-wasm
      console.log('Creating worker...');
      const worker = new Worker(bundle.mainWorker!);
      
      // Add error handler for worker
      worker.onerror = (error) => {
        console.error('Worker error:', error);
      };
      
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      console.log('Creating AsyncDuckDB instance...');
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      
      console.log('Instantiating DuckDB...');
      await this.db.instantiate(bundle.mainModule);
      
      // Create connection
      console.log('Creating connection...');
      this.conn = await this.db.connect();
      
      console.log('DuckDB WASM initialized successfully');
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize DuckDB WASM:', error);
      throw new Error(`Failed to initialize DuckDB WASM: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async loadFile(file: File): Promise<void> {
    console.log('Loading file:', file.name, 'Size:', file.size);
    await this.ensureInitialized();
    
    try {
      // Read file as ArrayBuffer
      console.log('Reading file as ArrayBuffer...');
      const buffer = await file.arrayBuffer();
      console.log('File buffer size:', buffer.byteLength);
      
      // Close the current empty database connection
      await this.conn!.close();
      await this.db!.close();
      
      // Initialize a new database instance
      const worker = new Worker('/duckdb-browser-eh.worker.js');
      worker.onerror = (error) => {
        console.error('Worker error:', error);
      };
      
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate('/duckdb-eh.wasm');
      
      // Register the uploaded file
      console.log('Registering file with DuckDB...');
      await this.db.registerFileBuffer(file.name, new Uint8Array(buffer));
      
      // Connect and directly open the file as database
      this.conn = await this.db.connect();
      console.log('Opening database file...');
      await this.conn.query(`OPEN '${file.name}'`);
      
      // Verify tables are accessible
      const tables = await this.conn.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'main'
      `);
      
      console.log(`Database loaded successfully - found ${tables.numRows} tables in main schema`);
      
    } catch (error) {
      console.error('Error loading file:', error);
      throw error;
    }
  }

  async getTableData(query: Query): Promise<TableDataResponse> {
    console.log('[WasmDatabase] getTableData called - checking schema name...');
    
    const { sql, countSql } = this.buildQuerySQL(query);
    
    console.log('[WasmDatabase] About to execute SQL:', sql);
    
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


}