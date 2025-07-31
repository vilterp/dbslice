import { createServer, Config } from './server';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';

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

// Create server with database connection and config
const { app } = createServer(db, config);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : config.server.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});