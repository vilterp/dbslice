import express, { Request, Response } from 'express';
import cors from 'cors';
import * as duckdb from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';

const app = express();

// Configuration interface
interface Config {
  database: {
    path: string;
    type: 'file' | 'memory';
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

// Load configuration
let config: Config;
try {
  const configPath = path.join(__dirname, '../config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
  console.log(`📁 Loading DuckDB from: ${config.database.path}`);
} catch (error) {
  console.error('❌ Error loading config.json:', (error as Error).message);
  console.log('📝 Using default in-memory database');
  config = {
    database: { path: ':memory:', type: 'memory' },
    server: { port: 3001, host: 'localhost' },
    api: { maxRows: 1000, maxHistogramBins: 50 }
  };
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : config.server.port;

app.use(cors());
app.use(express.json());

// Initialize database connection
let db: duckdb.Database;
if (config.database.type === 'file' && config.database.path !== ':memory:') {
  // Check if file exists
  if (fs.existsSync(config.database.path)) {
    db = new duckdb.Database(config.database.path);
    console.log(`✅ Connected to DuckDB file: ${config.database.path}`);
  } else {
    console.error(`❌ DuckDB file not found: ${config.database.path}`);
    console.log('📝 Falling back to in-memory database');
    db = new duckdb.Database(':memory:');
  }
} else {
  db = new duckdb.Database(':memory:');
  console.log('📝 Using in-memory database');
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

// Promisified query function
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

// Utility function to sanitize identifiers
const sanitizeIdentifier = (identifier: string): string => {
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
};

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
    const { filters = {}, limit = config.api.maxRows, offset = 0, orderBy, orderDir } = req.body;

    // Sanitize table name
    const sanitizedTableName = sanitizeIdentifier(tableName);
    let baseQuery = `FROM ${sanitizedTableName}`;
    const params: any[] = [];

    if (Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([column, value]) => {
        // Sanitize column name
        const sanitizedColumn = sanitizeIdentifier(column);

        // Check if this is a range filter (format: "min-max")
        if (typeof value === 'string' && value.includes('-') && !isNaN(parseFloat(value.split('-')[0]))) {
          const [min, max] = value.split('-').map(Number);
          params.push(min, max);
          return `${sanitizedColumn} >= ? AND ${sanitizedColumn} <= ?`;
        } else {
          params.push(value);
          return `${sanitizedColumn} = ?`;
        }
      });
      baseQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add ORDER BY if provided
    let orderClause = '';
    if (orderBy && typeof orderBy === 'string') {
      const sanitizedOrderBy = sanitizeIdentifier(orderBy);
      let dir = 'ASC';
      if (typeof orderDir === 'string' && ['asc', 'desc', 'ASC', 'DESC'].includes(orderDir)) {
        dir = orderDir.toUpperCase();
      }
      orderClause = ` ORDER BY ${sanitizedOrderBy} ${dir}`;
    }

    // Query for paginated data
    const limitValue = Math.min(limit as number, config.api.maxRows);
    const dataQuery = `SELECT * ${baseQuery}${orderClause} LIMIT ${limitValue} OFFSET ${offset}`;
    const data = await runQuery(dataQuery, params);

    // Query for total count (without LIMIT/OFFSET)
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await runQuery(countQuery, params);
    const total = countResult[0]?.total ?? 0;

    res.json({ data, total });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get histogram data for a column
app.get('/api/tables/:tableName/columns/:columnName/histogram', async (req: Request, res: Response) => {
  try {
    const { tableName, columnName } = req.params;
    const { filters = {}, bins = '20', column_type = 'text' } = req.query;
    
    // Sanitize names
    const sanitizedTableName = sanitizeIdentifier(tableName);
    const sanitizedColumnName = sanitizeIdentifier(columnName);
    
    // Build base WHERE clause for filters
    let whereClause = '';
    const params: any[] = [];
    
    if (typeof filters === 'object' && filters !== null && Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters as Record<string, any>).map(([column, value]) => {
        const sanitizedColumn = sanitizeIdentifier(column);
        if (sanitizedColumn !== sanitizedColumnName) {
          params.push(value);
          return `${sanitizedColumn} = ?`;
        }
        return null;
      }).filter(Boolean);
      
      if (conditions.length > 0) {
        whereClause = ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    let histogram: any[];
    const columnTypeStr = column_type as string;
    
    // Check if column is numerical for binning
    const isNumerical = ['INTEGER', 'BIGINT', 'DECIMAL', 'DOUBLE', 'FLOAT', 'NUMERIC', 'REAL'].some(type => 
      columnTypeStr.toUpperCase().includes(type)
    );
    
    if (isNumerical) {
      // For numerical columns, create binned histogram
      const binsCount = Math.min(parseInt(bins as string), 10); // Limit bins for numerical
      
      // Get min/max values for binning
      const rangeQuery = `SELECT MIN(${sanitizedColumnName}) as min_val, MAX(${sanitizedColumnName}) as max_val FROM ${sanitizedTableName}${whereClause}`;
      const rangeResult = await runQuery(rangeQuery, params);
      
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
        
        histogram = await runQuery(binQuery, params);
      } else {
        histogram = [];
      }
    } else {
      // For categorical columns, show top 5 values and number of distinct 'other' values
      const topValuesQuery = `SELECT ${sanitizedColumnName}, COUNT(*) as count FROM ${sanitizedTableName}${whereClause} GROUP BY ${sanitizedColumnName} ORDER BY count DESC LIMIT 5`;
      const topValues = await runQuery(topValuesQuery, params);

      // Get all distinct values
      const allDistinctQuery = `SELECT DISTINCT ${sanitizedColumnName} FROM ${sanitizedTableName}${whereClause}`;
      const allDistinct = await runQuery(allDistinctQuery, params);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});