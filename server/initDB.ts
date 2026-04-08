import * as duckdb from 'duckdb';
import * as fs from 'fs';
import logger from './logger';
import { Config } from './config';

// Database initialization function
export function initializeDatabase(config: Config): duckdb.Database {
  if (config.database.type === 'file' && config.database.path && config.database.path !== ':memory:') {
    // Check if file exists
    if (fs.existsSync(config.database.path)) {
      const db = new duckdb.Database(config.database.path);
      logger.info(`Connected to DuckDB file: ${config.database.path}`);
      return db;
    } else {
      logger.error(`DuckDB file not found: ${config.database.path}`);
      logger.info('Falling back to in-memory database');
      return new duckdb.Database(':memory:');
    }
  } else if (config.database.type === 's3') {
    // For S3, use in-memory database and create views
    const db = new duckdb.Database(':memory:');
    logger.info('Setting up S3 database connection');
    
    // Set up S3 authentication
    const s3SecretQuery = `CREATE SECRET secret2 (
      TYPE s3,
      PROVIDER credential_chain,
      REGION 'us-east-1'
    )`;
    logger.info('Executing S3 secret creation', { query: s3SecretQuery });
    db.exec(s3SecretQuery, (err) => {
      if (err) {
        logger.error('Error creating S3 secret:', err.message);
      } else {
        logger.info('S3 authentication configured');
      }
    });
    
    // Create views for S3 tables
    if (config.database.tables) {
      for (const [tableName, tableConfig] of Object.entries(config.database.tables)) {
        const s3Path = typeof tableConfig === 'string' ? tableConfig : tableConfig.url;
        const viewQuery = `CREATE VIEW ${tableName} AS SELECT * FROM '${s3Path}'`;
        logger.info('Creating S3 view', { tableName, query: viewQuery });
        db.exec(viewQuery, (err) => {
          if (err) {
            logger.error(`Error creating view ${tableName}:`, err.message);
          } else {
            logger.info(`Created S3 view: ${tableName}`);
          }
        });
      }
    }
    return db;
  } else if (config.database.type === 'sqlite' && config.database.path) {
    const sqlitePath = config.database.path;
    if (!fs.existsSync(sqlitePath)) {
      logger.error(`SQLite file not found: ${sqlitePath}`);
      logger.info('Falling back to in-memory database');
      return new duckdb.Database(':memory:');
    }
    const db = new duckdb.Database(':memory:');
    logger.info(`Connecting to SQLite file via DuckDB: ${sqlitePath}`);

    const escapedPath = sqlitePath.replace(/'/g, "''");
    db.exec(`INSTALL sqlite; LOAD sqlite; ATTACH '${escapedPath}' AS sqlite_db (TYPE SQLITE, READ_ONLY)`, (err) => {
      if (err) {
        logger.error('Error setting up SQLite connection:', err.message);
        return;
      }

      const conn = db.connect();
      conn.all(
        "SELECT table_name FROM information_schema.tables WHERE table_catalog = 'sqlite_db' AND table_schema = 'main'",
        (tablesErr, rows) => {
          if (tablesErr) {
            logger.error('Error listing SQLite tables:', tablesErr.message);
            return;
          }
          logger.info(`Found ${(rows || []).length} table(s) in SQLite database`);
          for (const row of rows || []) {
            const tableName = row.table_name as string;
            const escaped = tableName.replace(/"/g, '""');
            db.exec(
              `CREATE VIEW "${escaped}" AS SELECT * FROM sqlite_db.main."${escaped}"`,
              (viewErr) => {
                if (viewErr) {
                  logger.error(`Error creating view for table ${tableName}:`, viewErr.message);
                } else {
                  logger.info(`Created view for SQLite table: ${tableName}`);
                }
              }
            );
          }
        }
      );
    });

    return db;
  } else {
    const db = new duckdb.Database(':memory:');
    logger.info('Using in-memory database');
    return db;
  }
}