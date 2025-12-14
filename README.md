# Replit MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to interact with Replit workspaces directly, without needing an agentic browser or constant user intervention.

## Features

- **User Management**: Get information about the authenticated user
- **Repl Management**: List repls, get repl info by URL, run and stop repls
- **File Operations**: Read, write, create, delete files and directories
- **Search**: Search for content within files

## Installation

### From Smithery

```bash
smithery install replit-workspace --client claude
```

### Manual Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run: `npm start`

## Configuration

The server requires a `REPLIT_TOKEN` environment variable containing your Replit `connect.sid` cookie token.

### Getting Your Token

1. Log into Replit in your browser
2. Open Developer Tools (F12)
3. Go to Application > Cookies > replit.com
4. Copy the value of `connect.sid`

### Claude Desktop Configuration

Add to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "replit": {
      "command": "node",
      "args": ["/path/to/replit-mcp-server/dist/index.js"],
      "env": {
        "REPLIT_TOKEN": "your-connect-sid-token"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_current_user` | Get info about the authenticated user |
| `list_repls` | List repls owned by the user |
| `get_repl_by_url` | Get repl info by URL |
| `set_active_repl` | Set the active repl for subsequent operations |
| `read_file` | Read file contents |
| `write_file` | Write content to a file |
| `list_files` | List files in a directory |
| `create_file` | Create a new file |
| `delete_file` | Delete a file |
| `create_directory` | Create a new directory |
| `run_repl` | Start a repl |
| `stop_repl` | Stop a running repl |
| `search_files` | Search for content in files |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Start production server
npm start
```

## Deployment to Smithery

1. Ensure you have a `Dockerfile` and `smithery.json` in your repo
2. Push to GitHub
3. Connect your repository via Smithery dashboard
4. Deploy

## License

MIT
