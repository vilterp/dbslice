import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import logger from './logger';

// Configuration interface  
export interface Config {
  database: {
    path?: string;
    type: 'file' | 'memory' | 's3' | 'sqlite';
    tables?: { [key: string]: string | { url: string; no_histogram?: string[] } };
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

// Configuration loading function
export function loadConfig(configPath?: string): Config {
  try {
    let resolvedConfigPath: string;
    
    if (configPath) {
      // Use provided config path
      resolvedConfigPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
    } else {
      // Try YAML first, then fallback to JSON for backward compatibility
      resolvedConfigPath = path.join(__dirname, '../config.yaml');
      if (!fs.existsSync(resolvedConfigPath)) {
        resolvedConfigPath = path.join(__dirname, '../config.json');
      }
    }
    
    const configData = fs.readFileSync(resolvedConfigPath, 'utf8');
    
    let config: Config;
    if (resolvedConfigPath.endsWith('.yaml') || resolvedConfigPath.endsWith('.yml')) {
      config = yaml.load(configData) as Config;
    } else {
      config = JSON.parse(configData);
    }
    
    logger.info(`Using config file: ${path.basename(resolvedConfigPath)}`);
    if (config.database.type === 's3') {
      logger.info(`Using S3 database with ${Object.keys(config.database.tables || {}).length} table(s)`);
    }
    // Note: Don't log database path here - it may be overridden by CLI args
    // The actual database path will be logged by initializeDatabase()
    
    return config;
  } catch (error) {
    logger.error('Error loading config file:', (error as Error).message);
    logger.info('Using default in-memory database');
    return {
      database: { path: ':memory:', type: 'memory' },
      server: { port: 3001, host: 'localhost' },
      api: { maxRows: 1000, maxHistogramBins: 50 }
    };
  }
}