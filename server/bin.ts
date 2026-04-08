#!/usr/bin/env node
import { createServer } from './server';
import { loadConfig } from './config';
import { initializeDatabase } from './initDB';
import logger from './logger';
import * as path from 'path';
import * as fs from 'fs';

// Set NODE_ENV to production when running via CLI
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Parse command line arguments
const args = process.argv.slice(2);

// If a database path is provided as argument, use it
let dbPath: string | undefined;
let configPath = 'config.yaml';

if (args.length > 0) {
  // First argument is the database path
  dbPath = path.resolve(args[0]);

  // Check if the file exists
  if (!fs.existsSync(dbPath)) {
    logger.error(`Database file not found: ${dbPath}`);
    process.exit(1);
  }

  logger.info(`Using database: ${dbPath}`);
}

// Load configuration
const config = loadConfig(configPath);

// Override config with CLI argument if provided
if (dbPath) {
  config.database.path = dbPath;
  config.database.type = 'file';
}

// Initialize database connection
const db = initializeDatabase(config);

// Create server with database connection and config
const { app } = createServer(db, config);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : config.server.port;

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
