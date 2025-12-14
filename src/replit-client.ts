import fetch from 'node-fetch';

export interface ReplitConfig {
  token: string;
  replId?: string;
}

export interface FileInfo {
  path: string;
  type: 'file' | 'directory';
}

export interface ReplInfo {
  id: string;
  slug: string;
  title: string;
  description: string;
  language: string;
  url: string;
}

interface MutationResult {
  __typename: string;
  message?: string;
}

const GRAPHQL_URL = 'https://replit.com/graphql';

export class ReplitClient {
  private token: string;
  private replId?: string;

  constructor(config: ReplitConfig) {
    this.token = config.token;
    this.replId = config.replId;
  }

  private async query(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `connect.sid=${this.token}`,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Replit-MCP-Server/1.0',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { data?: unknown; errors?: Array<{ message: string }> };
    
    if (result.errors && result.errors.length > 0) {
      throw new Error(`GraphQL error: ${result.errors.map(e => e.message).join(', ')}`);
    }

    return result.data;
  }

  private checkMutationResult(result: MutationResult | null, successType: string, operation: string): void {
    if (!result) {
      throw new Error(`${operation} failed: No response from server`);
    }
    if (result.__typename !== successType) {
      throw new Error(`${operation} failed: ${result.message || 'Unknown error'}`);
    }
  }

  setReplId(replId: string): void {
    this.replId = replId;
  }

  async getCurrentUser(): Promise<{ id: string; username: string; email: string } | null> {
    const query = `
      query CurrentUser {
        currentUser {
          id
          username
          email
        }
      }
    `;

    const data = await this.query(query) as { currentUser: { id: string; username: string; email: string } | null };
    return data.currentUser;
  }

  async getReplByUrl(url: string): Promise<ReplInfo | null> {
    const query = `
      query ReplByUrl($url: String!) {
        repl(url: $url) {
          id
          slug
          title
          description
          templateInfo {
            label
          }
          url
        }
      }
    `;

    const data = await this.query(query, { url }) as { repl: { id: string; slug: string; title: string; description: string; templateInfo?: { label: string }; url: string } | null };
    if (!data.repl) return null;
    
    return {
      id: data.repl.id,
      slug: data.repl.slug,
      title: data.repl.title,
      description: data.repl.description,
      language: data.repl.templateInfo?.label || 'unknown',
      url: data.repl.url,
    };
  }

  async listUserRepls(limit: number = 20): Promise<ReplInfo[]> {
    const query = `
      query UserRepls($limit: Int!) {
        currentUser {
          repls(count: $limit) {
            items {
              id
              slug
              title
              description
              templateInfo {
                label
              }
              url
            }
          }
        }
      }
    `;

    const data = await this.query(query, { limit }) as { 
      currentUser: { 
        repls: { 
          items: Array<{ id: string; slug: string; title: string; description: string; templateInfo?: { label: string }; url: string }> 
        } 
      } | null 
    };
    
    if (!data.currentUser) {
      throw new Error('Failed to get user repls: User not authenticated or no access');
    }
    
    return data.currentUser.repls.items.map(repl => ({
      id: repl.id,
      slug: repl.slug,
      title: repl.title,
      description: repl.description,
      language: repl.templateInfo?.label || 'unknown',
      url: repl.url,
    }));
  }

  async readFile(path: string, replId?: string): Promise<string> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      query ReadFile($replId: String!, $path: String!) {
        repl(id: $replId) {
          ... on Repl {
            fileByPath(path: $path) {
              ... on File {
                content
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      repl: { fileByPath: { content: string } | null } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    if (!data.repl.fileByPath) {
      throw new Error(`File not found: ${path}`);
    }

    return data.repl.fileByPath.content;
  }

  async writeFile(path: string, content: string, replId?: string): Promise<boolean> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation WriteFile($replId: String!, $path: String!, $content: String!) {
        writeFile(replId: $replId, path: $path, content: $content) {
          __typename
          ... on WriteFileError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path, content }) as {
      writeFile: MutationResult | null
    };
    
    this.checkMutationResult(data.writeFile, 'WriteFileSuccess', `Write file "${path}"`);
    return true;
  }

  async listFiles(path: string = '.', replId?: string): Promise<FileInfo[]> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      query ListFiles($replId: String!, $path: String!) {
        repl(id: $replId) {
          ... on Repl {
            fileByPath(path: $path) {
              ... on Directory {
                children {
                  filename
                  ... on File {
                    __typename
                  }
                  ... on Directory {
                    __typename
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      repl: { 
        fileByPath: { 
          children: Array<{ filename: string; __typename: string }> 
        } | null 
      } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    if (!data.repl.fileByPath) {
      throw new Error(`Directory not found: ${path}`);
    }

    return data.repl.fileByPath.children.map(child => ({
      path: child.filename,
      type: child.__typename === 'Directory' ? 'directory' : 'file',
    }));
  }

  async createFile(path: string, content: string = '', replId?: string): Promise<boolean> {
    return this.writeFile(path, content, replId);
  }

  async deleteFile(path: string, replId?: string): Promise<boolean> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation DeleteFile($replId: String!, $path: String!) {
        deleteFile(replId: $replId, path: $path) {
          __typename
          ... on DeleteFileError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      deleteFile: MutationResult | null
    };
    
    this.checkMutationResult(data.deleteFile, 'DeleteFileSuccess', `Delete file "${path}"`);
    return true;
  }

  async createDirectory(path: string, replId?: string): Promise<boolean> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation CreateDirectory($replId: String!, $path: String!) {
        createDirectory(replId: $replId, path: $path) {
          __typename
          ... on CreateDirectoryError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId, path }) as {
      createDirectory: MutationResult | null
    };
    
    this.checkMutationResult(data.createDirectory, 'CreateDirectorySuccess', `Create directory "${path}"`);
    return true;
  }

  async runRepl(replId?: string): Promise<{ success: boolean; message: string }> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation RunRepl($replId: String!) {
        runRepl(replId: $replId) {
          __typename
          ... on RunReplError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId }) as {
      runRepl: MutationResult | null
    };

    if (!data.runRepl) {
      return { success: false, message: 'No response from server' };
    }

    if (data.runRepl.__typename !== 'RunReplSuccess') {
      return { success: false, message: data.runRepl.message || 'Failed to start repl' };
    }

    return { success: true, message: 'Repl started successfully' };
  }

  async stopRepl(replId?: string): Promise<{ success: boolean; message: string }> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const query = `
      mutation StopRepl($replId: String!) {
        stopRepl(replId: $replId) {
          __typename
          ... on StopReplError {
            message
          }
        }
      }
    `;

    const data = await this.query(query, { replId: targetReplId }) as {
      stopRepl: MutationResult | null
    };

    if (!data.stopRepl) {
      return { success: false, message: 'No response from server' };
    }

    if (data.stopRepl.__typename !== 'StopReplSuccess') {
      return { success: false, message: data.stopRepl.message || 'Failed to stop repl' };
    }

    return { success: true, message: 'Repl stopped successfully' };
  }

  async searchFiles(query_str: string, replId?: string): Promise<Array<{ path: string; matches: string[] }>> {
    const targetReplId = replId || this.replId;
    if (!targetReplId) {
      throw new Error('No repl ID specified. Please provide a replId or set a default repl.');
    }

    const gqlQuery = `
      query SearchFiles($replId: String!, $query: String!) {
        repl(id: $replId) {
          ... on Repl {
            search(query: $query) {
              results {
                path
                matches
              }
            }
          }
        }
      }
    `;

    const data = await this.query(gqlQuery, { replId: targetReplId, query: query_str }) as {
      repl: { search: { results: Array<{ path: string; matches: string[] }> } | null } | null
    };

    if (!data.repl) {
      throw new Error(`Repl not found or no access: ${targetReplId}`);
    }

    if (!data.repl.search) {
      return [];
    }

    return data.repl.search.results;
  }
}
