#!/usr/bin/env node

const transport = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();

if (transport === 'http') {
  const { startHttpServer } = await import('./src/httpTransport.js');
  await startHttpServer();
} else {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { createServer } = await import('./src/server.js');

  const server = createServer({ transport: 'stdio' });
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}
