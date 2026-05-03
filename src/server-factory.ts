import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { ReplitClient } from './replit-client.js';
import { getActiveReplId, setActiveReplId } from './state.js';

const TOOL_DEFINITIONS = [
  { name: 'get_current_user', description: 'Get information about the currently authenticated Replit user', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_repls', description: 'List repls owned by the current user', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Maximum number of repls to return (default: 20)' } }, required: [] } },
  { name: 'get_repl_by_url', description: 'Get information about a repl by its URL', inputSchema: { type: 'object', properties: { url: { type: 'string', description: 'The full URL of the repl (e.g., https://replit.com/@username/repl-name)' } }, required: ['url'] } },
  { name: 'set_active_repl', description: 'Set the active repl ID for subsequent file operations (persists for the life of the server process)', inputSchema: { type: 'object', properties: { replId: { type: 'string', description: 'The ID of the repl to set as active' } }, required: ['replId'] } },
  { name: 'read_file', description: 'Read the contents of a file in a Replit workspace', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to the file to read' }, replId: { type: 'string', description: 'Optional repl ID (uses active repl if not specified)' } }, required: ['path'] } },
  { name: 'write_file', description: 'Write content to a file in a Replit workspace', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' }, replId: { type: 'string' } }, required: ['path', 'content'] } },
  { name: 'list_files', description: 'List files and directories in a Replit workspace', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path to the directory to list (default: root)' }, replId: { type: 'string' } }, required: [] } },
  { name: 'create_file', description: 'Create a new file in a Replit workspace', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'Initial content for the file (default: empty)' }, replId: { type: 'string' } }, required: ['path'] } },
  { name: 'delete_file', description: 'Delete a file from a Replit workspace', inputSchema: { type: 'object', properties: { path: { type: 'string' }, replId: { type: 'string' } }, required: ['path'] } },
  { name: 'create_directory', description: 'Create a new directory in a Replit workspace', inputSchema: { type: 'object', properties: { path: { type: 'string' }, replId: { type: 'string' } }, required: ['path'] } },
  { name: 'run_repl', description: 'Start/run a Replit workspace', inputSchema: { type: 'object', properties: { replId: { type: 'string' } }, required: [] } },
  { name: 'stop_repl', description: 'Stop a running Replit workspace', inputSchema: { type: 'object', properties: { replId: { type: 'string' } }, required: [] } },
  { name: 'search_files', description: 'Search for content within files in a Replit workspace', inputSchema: { type: 'object', properties: { query: { type: 'string' }, replId: { type: 'string' } }, required: ['query'] } },
  { name: 'get_user_by_id', description: 'Fetch user information by their numeric ID', inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] } },
  { name: 'get_user_by_username', description: 'Fetch user information by their username', inputSchema: { type: 'object', properties: { username: { type: 'string' } }, required: ['username'] } },
  { name: 'create_repl', description: 'Create a new repl', inputSchema: { type: 'object', properties: { title: { type: 'string' }, language: { type: 'string', description: 'Programming language/template (e.g., python3, nodejs, html)' }, description: { type: 'string' }, isPrivate: { type: 'boolean' } }, required: ['title', 'language'] } },
  { name: 'fork_repl', description: 'Fork an existing repl by URL', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'delete_repl', description: 'Delete a repl by ID (requires confirmation)', inputSchema: { type: 'object', properties: { id: { type: 'string' }, confirm: { type: 'boolean', description: 'Must be true to confirm deletion' } }, required: ['id', 'confirm'] } },
  { name: 'get_secrets', description: 'List all environment variables/secrets for a repl', inputSchema: { type: 'object', properties: { replId: { type: 'string' } }, required: [] } },
  { name: 'set_secret', description: 'Set an environment variable/secret for a repl', inputSchema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, replId: { type: 'string' } }, required: ['key', 'value'] } },
  { name: 'delete_secret', description: 'Delete an environment variable/secret from a repl', inputSchema: { type: 'object', properties: { key: { type: 'string' }, replId: { type: 'string' } }, required: ['key'] } },
  { name: 'get_deployment', description: 'Get deployment information for a repl', inputSchema: { type: 'object', properties: { replId: { type: 'string' } }, required: [] } },
  { name: 'create_deployment', description: 'Deploy/publish a repl', inputSchema: { type: 'object', properties: { replId: { type: 'string' } }, required: [] } },
  { name: 'get_repl_details', description: 'Get detailed repl information including comments, multiplayers, tags, run count, like count, and fork count', inputSchema: { type: 'object', properties: { replId: { type: 'string' }, url: { type: 'string' } }, required: [] } },
];

function buildClient(): ReplitClient {
  const token = process.env.REPLIT_TOKEN;
  if (!token) {
    throw new McpError(ErrorCode.InvalidRequest, 'REPLIT_TOKEN environment variable is not set on the server.');
  }
  return new ReplitClient({ token, replId: getActiveReplId() });
}

export function createMcpServer(): Server {
  const server = new Server(
    { name: 'replit-mcp-server', version: '1.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFINITIONS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const client = buildClient();
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
        case 'set_active_repl': {
          const replId = (args as { replId: string }).replId;
          setActiveReplId(replId);
          client.setReplId(replId);
          result = { success: true, message: `Active repl set to: ${replId}` };
          break;
        }
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
        case 'get_user_by_id':
          result = await client.getUserById((args as { id: number }).id);
          break;
        case 'get_user_by_username':
          result = await client.getUserByUsername((args as { username: string }).username);
          break;
        case 'create_repl': {
          const { title, language, description, isPrivate } = args as { title: string; language: string; description?: string; isPrivate?: boolean };
          result = await client.createRepl({ title, language, description, isPrivate });
          break;
        }
        case 'fork_repl':
          result = await client.forkRepl((args as { url: string }).url);
          break;
        case 'delete_repl': {
          const { id, confirm } = args as { id: string; confirm: boolean };
          result = await client.deleteRepl(id, confirm);
          break;
        }
        case 'get_secrets':
          result = await client.getSecrets((args as { replId?: string }).replId);
          break;
        case 'set_secret': {
          const { key, value, replId } = args as { key: string; value: string; replId?: string };
          result = await client.setSecret(key, value, replId);
          break;
        }
        case 'delete_secret': {
          const { key, replId } = args as { key: string; replId?: string };
          result = await client.deleteSecret(key, replId);
          break;
        }
        case 'get_deployment':
          result = await client.getDeployment((args as { replId?: string }).replId);
          break;
        case 'create_deployment':
          result = await client.createDeployment((args as { replId?: string }).replId);
          break;
        case 'get_repl_details': {
          const { replId, url } = args as { replId?: string; url?: string };
          result = await client.getReplDetails(replId, url);
          break;
        }
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return {
        content: [
          { type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;
      throw new McpError(
        ErrorCode.InternalError,
        `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  return server;
}
