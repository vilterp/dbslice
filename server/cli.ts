import { createServer } from './server';
import { loadConfig } from './config';
import { initializeDatabase } from './initDB';
import logger from './logger';

// Parse command line arguments
const args = process.argv.slice(2);
const configPath = args.length > 0 ? args[0] : 'config.yaml';

logger.info(`Config path: ${configPath}`);

// Load configuration
const config = loadConfig(configPath);

// Initialize database connection
const db = initializeDatabase(config);

// Create server with database connection and config
const { app } = createServer(db, config);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : config.server.port;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});