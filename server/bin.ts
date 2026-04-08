#!/usr/bin/env node
import { createServer } from './server';
import { initializeDatabase } from './initDB';
import { Config } from './config';
import logger from './logger';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

process.env.NODE_ENV = 'production';

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === 'darwin') exec(`open "${url}"`);
  else if (platform === 'win32') exec(`start "" "${url}"`);
  else exec(`xdg-open "${url}"`);
}

function detectDbType(filePath: string): Config['database']['type'] {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.sqlite' || ext === '.db') return 'sqlite';
  return 'file';
}

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: dbslice <file.duckdb|file.sqlite>');
  process.exit(1);
}

const dbPath = path.resolve(args[0]);

if (!fs.existsSync(dbPath)) {
  console.error(`File not found: ${dbPath}`);
  process.exit(1);
}

const dbType = detectDbType(dbPath);

const config: Config = {
  database: { path: dbPath, type: dbType },
  server: { port: 3001, host: 'localhost' },
  api: { maxRows: 1000, maxHistogramBins: 50 },
};

logger.info(`Opening ${dbType === 'sqlite' ? 'SQLite' : 'DuckDB'} file: ${dbPath}`);

const db = initializeDatabase(config);
const { app } = createServer(db, config);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : config.server.port;
const url = `http://localhost:${PORT}`;

app.listen(PORT, () => {
  logger.info(`dbslice running at ${url}`);
  openBrowser(url);
});
