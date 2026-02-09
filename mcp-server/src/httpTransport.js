import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from './server.js';

/**
 * Simple in-memory event store for SSE stream resumability.
 * Based on the SDK's InMemoryEventStore example.
 */
class InMemoryEventStore {
  constructor() { this.events = new Map(); }

  generateEventId(streamId) {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  getStreamIdFromEventId(eventId) {
    return eventId.split('_')[0] || '';
  }

  async storeEvent(streamId, message) {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message });
    return eventId;
  }

  async replayEventsAfter(lastEventId, { send }) {
    if (!lastEventId || !this.events.has(lastEventId)) return '';
    const streamId = this.getStreamIdFromEventId(lastEventId);
    if (!streamId) return '';

    let found = false;
    const sorted = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [eventId, { streamId: sid, message }] of sorted) {
      if (sid !== streamId) continue;
      if (eventId === lastEventId) { found = true; continue; }
      if (found) await send(eventId, message);
    }
    return streamId;
  }
}

/**
 * Start the MCP server in HTTP (Streamable HTTP) mode.
 *
 * Uses the SDK's createMcpExpressApp for Express 5 setup with DNS rebinding
 * protection, and StreamableHTTPServerTransport for stateful session management.
 */
export async function startHttpServer() {
  const port = parseInt(process.env.MCP_PORT, 10) || 3100;
  const apiKey = process.env.MCP_API_KEY;

  const app = createMcpExpressApp({ host: '0.0.0.0' });

  // ── Bearer token authentication (optional) ──────────────────────────
  if (apiKey) {
    app.use('/mcp', (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${apiKey}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });
  }

  // ── Session management ───────────────────────────────────────────────
  /** @type {Map<string, { transport: StreamableHTTPServerTransport, server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer }>} */
  const sessions = new Map();

  // ── POST /mcp ── handle JSON-RPC requests ────────────────────────────
  app.post('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    // Existing session
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — only allowed for initialize requests
    if (!isInitializeRequest(req.body)) {
      res.status(400).json({ error: 'First request must be an initialize request' });
      return;
    }

    const eventStore = new InMemoryEventStore();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore,
    });

    const mcpServer = createServer({ transport: 'http' });
    await mcpServer.connect(transport);

    // Track the session
    const newSessionId = transport.sessionId;
    sessions.set(newSessionId, { transport, server: mcpServer });

    // Clean up when the transport closes
    transport.onclose = () => {
      sessions.delete(newSessionId);
    };

    await transport.handleRequest(req, res, req.body);
  });

  // ── GET /mcp ── SSE stream for server-initiated messages ─────────────
  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId) {
      res.status(400).json({ error: 'mcp-session-id header is required' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await session.transport.handleRequest(req, res);
  });

  // ── DELETE /mcp ── terminate session ─────────────────────────────────
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId) {
      res.status(400).json({ error: 'mcp-session-id header is required' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await session.transport.close();
    sessions.delete(sessionId);
    res.status(200).json({ message: 'Session terminated' });
  });

  // ── GET /health ── health check ──────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      transport: 'streamable-http',
      activeSessions: sessions.size,
    });
  });

  // ── Start listening ──────────────────────────────────────────────────
  const httpServer = app.listen(port, '0.0.0.0', () => {
    console.log(`MCP HTTP server listening on port ${port}`);
    console.log(`  Endpoint: http://0.0.0.0:${port}/mcp`);
    console.log(`  Health:   http://0.0.0.0:${port}/health`);
    if (apiKey) {
      console.log('  Auth:     Bearer token required');
    }
  });

  // ── Graceful shutdown ────────────────────────────────────────────────
  const shutdown = async () => {
    console.log('\nShutting down MCP HTTP server...');

    // Close all active sessions
    for (const [id, session] of sessions) {
      try {
        await session.transport.close();
      } catch { /* ignore */ }
      sessions.delete(id);
    }

    httpServer.close(() => {
      console.log('MCP HTTP server stopped.');
      process.exit(0);
    });

    // Force exit after 5 seconds
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
