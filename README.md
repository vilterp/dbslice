# DuckDB Explorer

[![CI](https://github.com/[username]/duckdb-explore/actions/workflows/ci.yml/badge.svg)](https://github.com/[username]/duckdb-explore/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/[username]/duckdb-explore/branch/main/graph/badge.svg)](https://codecov.io/gh/[username]/duckdb-explore)

A modern web-based data exploration UI for DuckDB with Datadog-style faceted search capabilities.

## Features

- 🚀 **Fast TypeScript Backend**: Node.js server with full type safety
- ⚡ **Modern React Frontend**: Built with esbuild for lightning-fast builds
- 🔍 **Faceted Search**: Datadog-style histogram filters in sidebar
- 📊 **Interactive Data Exploration**: Click histogram bars to filter data
- 🗃️ **DuckDB Integration**: Direct connection to DuckDB files or in-memory databases
- 🎨 **Clean UI**: Responsive design with proper data table display
- 🧪 **Comprehensive Tests**: Full test coverage with Jest and Supertest

## Architecture

```
┌─────────────────┐    HTTP API    ┌──────────────────┐
│  React Frontend │ ◄─────────────► │ TypeScript Server│
│  (Port 3002)    │                │  (Port 3001)     │
└─────────────────┘                └──────────────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │   DuckDB File    │
                                   │  or In-Memory    │
                                   └──────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- Yarn package manager

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd duckdb-explore
   yarn install
   ```

2. **Configure database path:**
   ```bash
   # Edit config.json to point to your DuckDB file
   {
     "database": {
       "path": "/path/to/your/database.duckdb",
       "type": "file"
     }
   }
   ```

3. **Start development servers:**
   ```bash
   yarn dev
   ```
   
   This starts:
   - Backend server at `http://localhost:3001`
   - Frontend at `http://localhost:3002`

### Production Deployment

1. **Build the application:**
   ```bash
   yarn build
   ```

2. **Start the production server:**
   ```bash
   yarn start
   ```

## Development

### Project Structure
```
duckdb-explore/
├── server/           # TypeScript backend
│   ├── index.ts      # Main server file
│   ├── __tests__/    # API tests
│   └── tsconfig.json
├── client/           # React frontend
│   ├── src/
│   ├── public/
│   ├── build.js      # esbuild configuration
│   └── tsconfig.json
├── config.json       # Database configuration
└── jest.config.js    # Test configuration
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start both client and server in development mode |
| `yarn server:dev` | Start only the backend server with hot reload |
| `yarn client:dev` | Start only the frontend with hot reload |
| `yarn build` | Build both client and server for production |
| `yarn test` | Run all tests |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:coverage` | Generate test coverage report |

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tables` | List all database tables |
| `GET` | `/api/tables/{table}/columns` | Get table column metadata |
| `POST` | `/api/tables/{table}/data` | Get filtered table data |
| `GET` | `/api/tables/{table}/columns/{column}/histogram` | Get column value histogram |
| `GET` | `/api/info` | Get database configuration info |

### Testing

The project includes comprehensive test coverage:

- **Unit Tests**: API endpoint testing with real DuckDB data
- **Integration Tests**: Full request/response cycle testing  
- **Sample Data**: Realistic test datasets for products, customers, orders
- **Error Handling**: Proper error response testing

Run tests:
```bash
yarn test                # Run all tests
yarn test:watch          # Watch mode
yarn test:coverage       # With coverage report
```

## Configuration

### Database Configuration (`config.json`)

```json
{
  "database": {
    "path": "/path/to/database.duckdb",
    "type": "file"
  },
  "server": {
    "port": 3001,
    "host": "localhost"
  },
  "api": {
    "maxRows": 1000,
    "maxHistogramBins": 50
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port (overrides config) |
| `NODE_ENV` | `development` | Environment mode |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure tests pass: `yarn test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## License

MIT License - see LICENSE file for details.