#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerWorkboardTools } from './src/tools/workboards.js';
import { registerJobTools } from './src/tools/jobs.js';
import { registerMediaTools } from './src/tools/media.js';

const server = new McpServer({
  name: 'vcc-manager',
  version: '1.0.0',
});

// Register all tools
registerWorkboardTools(server);
registerJobTools(server);
registerMediaTools(server);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
