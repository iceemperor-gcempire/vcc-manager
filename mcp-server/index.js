#!/usr/bin/env node

const transport = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();

if (transport === 'http') {
  const { startHttpServer } = await import('./src/httpTransport.js');
  await startHttpServer();
} else {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const { createServer } = await import('./src/server.js');

  const apiKey = process.env.VCC_API_KEY;
  if (!apiKey) {
    console.error('Error: VCC_API_KEY environment variable is required for stdio mode.');
    process.exit(1);
  }

  const server = createServer({ transport: 'stdio', apiKey });
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
}
