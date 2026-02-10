import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWorkboardTools } from './tools/workboards.js';
import { registerJobTools } from './tools/jobs.js';
import { registerMediaTools } from './tools/media.js';

/**
 * Create and configure an McpServer instance with all tools registered.
 *
 * @param {{ transport?: 'stdio' | 'http' }} options
 * @returns {McpServer}
 */
export function createServer(options = {}) {
  const server = new McpServer({
    name: 'vcc-manager',
    version: '1.0.0',
  });

  registerWorkboardTools(server);
  registerJobTools(server);
  registerMediaTools(server, options);

  return server;
}
