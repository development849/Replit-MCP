#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ReplitClient } from './replit-client.js';

const TOOL_DEFINITIONS = [
  {
    name: 'get_current_user',
    description: 'Get information about the currently authenticated Replit user',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_repls',
    description: 'List repls owned by the current user',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of repls to return (default: 20)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_repl_by_url',
    description: 'Get information about a repl by its URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL of the repl (e.g., https://replit.com/@username/repl-name)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'set_active_repl',
    description: 'Set the active repl ID for subsequent file operations',
    inputSchema: {
      type: 'object',
      properties: {
        replId: {
          type: 'string',
          description: 'The ID of the repl to set as active',
        },
      },
      required: ['replId'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file in a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to read',
        },
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the directory to list (default: root)',
        },
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file in a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path for the new file',
        },
        content: {
          type: 'string',
          description: 'Initial content for the file (default: empty)',
        },
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to delete',
        },
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_directory',
    description: 'Create a new directory in a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path for the new directory',
        },
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_repl',
    description: 'Start/run a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'stop_repl',
    description: 'Stop a running Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_files',
    description: 'Search for content within files in a Replit workspace',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
        replId: {
          type: 'string',
          description: 'Optional repl ID (uses active repl if not specified)',
        },
      },
      required: ['query'],
    },
  },
];

class ReplitMCPServer {
  private server: Server;
  private client: ReplitClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'replit-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private getClient(): ReplitClient {
    if (!this.client) {
      const token = process.env.REPLIT_TOKEN;
      if (!token) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'REPLIT_TOKEN environment variable is not set. Please provide your Replit connect.sid token.'
        );
      }
      this.client = new ReplitClient({ token });
    }
    return this.client;
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const client = this.getClient();
        let result: unknown;

        switch (name) {
          case 'get_current_user':
            result = await client.getCurrentUser();
            break;

          case 'list_repls':
            result = await client.listUserRepls((args as { limit?: number })?.limit);
            break;

          case 'get_repl_by_url':
            result = await client.getReplByUrl((args as { url: string }).url);
            break;

          case 'set_active_repl':
            client.setReplId((args as { replId: string }).replId);
            result = { success: true, message: `Active repl set to: ${(args as { replId: string }).replId}` };
            break;

          case 'read_file': {
            const { path, replId } = args as { path: string; replId?: string };
            result = await client.readFile(path, replId);
            break;
          }

          case 'write_file': {
            const { path, content, replId } = args as { path: string; content: string; replId?: string };
            await client.writeFile(path, content, replId);
            result = { success: true, message: `File written: ${path}` };
            break;
          }

          case 'list_files': {
            const { path, replId } = args as { path?: string; replId?: string };
            result = await client.listFiles(path || '.', replId);
            break;
          }

          case 'create_file': {
            const { path, content, replId } = args as { path: string; content?: string; replId?: string };
            await client.createFile(path, content || '', replId);
            result = { success: true, message: `File created: ${path}` };
            break;
          }

          case 'delete_file': {
            const { path, replId } = args as { path: string; replId?: string };
            await client.deleteFile(path, replId);
            result = { success: true, message: `File deleted: ${path}` };
            break;
          }

          case 'create_directory': {
            const { path, replId } = args as { path: string; replId?: string };
            await client.createDirectory(path, replId);
            result = { success: true, message: `Directory created: ${path}` };
            break;
          }

          case 'run_repl': {
            const { replId } = args as { replId?: string };
            result = await client.runRepl(replId);
            break;
          }

          case 'stop_repl': {
            const { replId } = args as { replId?: string };
            result = await client.stopRepl(replId);
            break;
          }

          case 'search_files': {
            const { query, replId } = args as { query: string; replId?: string };
            result = await client.searchFiles(query, replId);
            break;
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Replit MCP Server running on stdio');
  }
}

const server = new ReplitMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
