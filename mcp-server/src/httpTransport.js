import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from './server.js';
import { checkApiKey } from './utils/apiClient.js';

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
 * VCC_BASE_URL_FOR_MCP 가 없으면 download_result 가 영상·오디오를 메타데이터만, 이미지는 base64 로 돌려준다.
 * 설치자가 원인을 알 수 있게 기동 시 알린다 (#993). 설정돼 있으면 null.
 * @returns {string|null}
 */
export function mediaBaseUrlWarning(env = process.env) {
  if (env.VCC_BASE_URL_FOR_MCP) return null;
  return [
    'VCC_BASE_URL_FOR_MCP 가 설정되지 않았습니다.',
    '  download_result 가 영상·오디오는 메타데이터만(파일 없음), 이미지는 base64 로 돌려줍니다.',
    '  MCP 클라이언트가 닿을 수 있는 VCC 주소로 설정하면 이미지·영상·오디오 모두 서명된 링크로 받습니다.',
  ].join('\n');
}

const REJECTED_KEY_MESSAGE = 'VCC API Key 가 거부됐습니다 (폐기·교체됐거나 잘못된 키). 새 키로 다시 연결하세요.';

/**
 * 세션이 붙잡은 키가 백엔드에서 거부됐으면 세션을 닫고 전송 단에서 401 을 돌려준다 (#993).
 * 도구 응답 안의 오류로만 두면 클라이언트는 인증 실패로 보지 않아 다시 인증하지 않는다.
 * @returns {Promise<boolean>} 401 로 응답했으면 true
 */
async function rejectIfKeyRevoked(sessions, sessionId, session, res) {
  if (!session.state?.authFailed) return false;
  sessions.delete(sessionId);
  try { await session.transport.close(); } catch { /* ignore */ }
  res.status(401).json({ error: REJECTED_KEY_MESSAGE });
  return true;
}

/**
 * HTTP 앱과 세션 저장소를 만든다 (리슨은 하지 않는다 — 테스트에서 그대로 쓴다).
 * @param {{ checkKey?: (apiKey: string) => Promise<'ok'|'invalid'|'unknown'> }} [deps]
 */
export function createHttpApp({ checkKey = checkApiKey } = {}) {
  const app = createMcpExpressApp({ host: '0.0.0.0' });

  // ── Session management ───────────────────────────────────────────────
  /** @type {Map<string, { transport: StreamableHTTPServerTransport, server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer, state: { authFailed: boolean } }>} */
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
      if (await rejectIfKeyRevoked(sessions, sessionId, session, res)) return;
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

    // 세션을 열기 전에 키가 통하는지 — 폐기·오타 키는 여기서 401 (백엔드가 안 닿으면 막지 않음)
    if ((await checkKey(apiKey)) === 'invalid') {
      res.status(401).json({ error: REJECTED_KEY_MESSAGE });
      return;
    }

    const state = { authFailed: false };
    const eventStore = new InMemoryEventStore();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore,
      onsessioninitialized: (sessionId) => {
        // Store session when initialized (avoids race condition with transport.sessionId)
        sessions.set(sessionId, { transport, server: mcpServer, state });
      },
    });

    // Clean up when the transport closes
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) sessions.delete(sid);
    };

    const mcpServer = createServer({ transport: 'http', apiKey, onAuthFailure: () => { state.authFailed = true; } });
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
    if (await rejectIfKeyRevoked(sessions, sessionId, session, res)) return;

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

  return { app, sessions };
}

/**
 * Start the MCP server in HTTP (Streamable HTTP) mode.
 *
 * Authentication: Clients must provide their VCC API Key as a Bearer token.
 * The MCP server forwards it as X-API-Key to the backend for per-user auth.
 */
export async function startHttpServer() {
  const port = parseInt(process.env.MCP_PORT, 10) || 3100;

  const { app, sessions } = createHttpApp();

  // ── Start listening ──────────────────────────────────────────────────
  const httpServer = app.listen(port, '0.0.0.0', () => {
    console.log(`MCP HTTP server listening on port ${port}`);
    console.log(`  Endpoint: http://0.0.0.0:${port}/mcp`);
    console.log(`  Health:   http://0.0.0.0:${port}/health`);
    console.log('  Auth:     Bearer token (VCC API Key) required');
    const warning = mediaBaseUrlWarning();
    if (warning) console.warn(`\n⚠️  ${warning}\n`);
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
