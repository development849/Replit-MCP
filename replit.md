# Replit MCP Server

## Overview
A Model Context Protocol (MCP) server that enables AI assistants to interact with Replit workspaces directly via the Replit GraphQL API. Deployable on Smithery.

## Project Architecture

### Structure
```
├── src/
│   ├── index.ts         # Main MCP server entry point
│   └── replit-client.ts # Replit GraphQL API client
├── dist/                # Compiled JavaScript output
├── Dockerfile           # Container for Smithery deployment
├── smithery.json        # Smithery registry metadata
├── package.json         # Node.js dependencies
└── tsconfig.json        # TypeScript configuration
```

### Key Technologies
- **TypeScript** - Main language
- **@modelcontextprotocol/sdk** - MCP SDK for building the server
- **node-fetch** - HTTP client for GraphQL requests
- **Smithery** - Deployment platform

### MCP Tools Available
1. **get_current_user** - Get authenticated user info
2. **list_repls** - List user's repls
3. **get_repl_by_url** - Get repl info by URL
4. **set_active_repl** - Set active repl for subsequent operations
5. **read_file** - Read file contents
6. **write_file** - Write to files
7. **list_files** - List directory contents
8. **create_file** - Create new files
9. **delete_file** - Delete files
10. **create_directory** - Create directories
11. **run_repl** - Start a repl
12. **stop_repl** - Stop a repl
13. **search_files** - Search file contents

### Authentication
Uses Replit's `connect.sid` cookie token for GraphQL API authentication. Token is passed via `REPLIT_TOKEN` environment variable.

### Deployment
- **Smithery**: Docker-based deployment with automatic scaling
- **Local**: `npm run dev` for development, `npm start` for production

## Development Commands
- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript
- `npm run dev` - Run in development mode
- `npm start` - Run production build

## Recent Changes
- Initial project setup with MCP server implementation
- Added Replit GraphQL client with file operations
- Created Dockerfile and smithery.json for Smithery deployment
