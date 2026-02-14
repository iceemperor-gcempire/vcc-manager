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
 * Extract Bearer token from Authorization header.
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

/**
 * Start the MCP server in HTTP (Streamable HTTP) mode.
 *
 * Authentication: Clients must provide their VCC API Key as a Bearer token.
 * The MCP server forwards it as X-API-Key to the backend for per-user auth.
 */
export async function startHttpServer() {
  const port = parseInt(process.env.MCP_PORT, 10) || 3100;

  const app = createMcpExpressApp({ host: '0.0.0.0' });

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

    // Extract API key from Bearer token
    const apiKey = extractBearerToken(req);
    if (!apiKey) {
      res.status(401).json({ error: 'Authorization header with Bearer token (VCC API Key) is required' });
      return;
    }

    const eventStore = new InMemoryEventStore();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore,
      onsessioninitialized: (sessionId) => {
        // Store session when initialized (avoids race condition with transport.sessionId)
        sessions.set(sessionId, { transport, server: mcpServer });
      },
    });

    // Clean up when the transport closes
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    const mcpServer = createServer({ transport: 'http', apiKey });
    await mcpServer.connect(transport);

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

    await session.transport.handleRequest(req, res);
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
    console.log('  Auth:     Bearer token (VCC API Key) required');
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
