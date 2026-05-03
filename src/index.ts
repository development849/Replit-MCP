#!/usr/bin/env node
import express, { Request, Response, NextFunction } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server-factory.js';

const PORT = Number(process.env.PORT) || 3000;
const BEARER = process.env.MCP_BEARER_TOKEN;
const REPLIT_TOKEN = process.env.REPLIT_TOKEN;

if (!BEARER) {
  console.error('FATAL: MCP_BEARER_TOKEN env var is required.');
  process.exit(1);
}
if (!REPLIT_TOKEN) {
  console.error('FATAL: REPLIT_TOKEN env var is required (your Replit connect.sid cookie).');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, name: 'replit-mcp-server', version: '1.1.0' });
});

function requireBearer(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? '';
  const expected = `Bearer ${BEARER}`;
  if (auth.length !== expected.length || auth !== expected) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

app.post('/mcp', requireBearer, async (req: Request, res: Response) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal_error' });
    }
  }
});

app.get('/mcp', requireBearer, (_req: Request, res: Response) => {
  res.status(405).json({ error: 'method_not_allowed', hint: 'Use POST for MCP requests.' });
});

app.listen(PORT, () => {
  console.error(`Replit MCP HTTP server listening on :${PORT}`);
});
