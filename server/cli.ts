import { createServer, loadConfig, initializeDatabase } from './server';

// Parse command line arguments
const args = process.argv.slice(2);
const configPath = args.length > 0 ? args[0] : 'config.yaml';

console.log(`📋 Config path: ${configPath}`);

// Load configuration
const config = loadConfig(configPath);

// Initialize database connection
const db = initializeDatabase(config);

// Create server with database connection and config
const { app } = createServer(db, config);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : config.server.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});