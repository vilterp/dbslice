# DuckDB Explorer - Build Modes

This application can be built in two different modes:

## 1. Client-Server Mode (Default)

In this mode, the UI communicates with a Node.js server that runs DuckDB queries.

**Features:**
- Full server-side DuckDB functionality
- Support for large databases
- All DuckDB features available
- Optimized for performance

**Development:**
```bash
# Run both server and client
yarn dev:client

# Or run individually
yarn server:dev    # Server on port 3001
yarn client:dev:client    # Client on port 3002
```

**Build:**
```bash
yarn build:client
```

This creates:
- `server/dist/` - Server build
- `client/build-client/` - Client build

**Usage:**
1. Start the server with a database: `node server/dist/cli.js --db path/to/database.db`
2. Serve the client build files or access the server's built-in static file serving

## 2. WASM Mode

In this mode, the entire application runs in the browser using DuckDB WASM. Users can upload DuckDB files directly.

**Features:**
- Fully client-side execution
- No server required
- File upload interface
- Complete privacy (no data sent to server)
- Works offline

**Development:**
```bash
yarn dev:wasm    # WASM version on port 3003
```

**Build:**
```bash
yarn build:wasm
```

This creates:
- `client/build-wasm/` - WASM build

**Usage:**
1. Serve the `client/build-wasm/` directory
2. Users upload DuckDB files through the web interface

## Architecture

Both modes use the same core components but with different Database implementations:

### Client-Server Mode
```
React UI (AppClient) 
  → Explorer Component 
  → ClientDatabase 
  → HTTP API calls 
  → Server 
  → ServerDatabase 
  → Node.js DuckDB
```

### WASM Mode
```
React UI (AppWasm) 
  → Explorer Component 
  → WasmDatabase 
  → DuckDB WASM
```

### Shared Components

- **Database Interface**: Common interface for all database operations
- **Explorer**: Main UI component that takes any Database implementation
- **Tab, Sidebar, DataTable, etc.**: All UI components work with both modes

## Build All

To build both versions:
```bash
yarn build:all
```

This creates both `client/build-client/` and `client/build-wasm/` directories.