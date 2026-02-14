import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createApiClient } from './utils/apiClient.js';
import { registerWorkboardTools } from './tools/workboards.js';
import { registerJobTools } from './tools/jobs.js';
import { registerMediaTools } from './tools/media.js';

/**
 * Create and configure an McpServer instance with all tools registered.
 *
 * @param {{ transport?: 'stdio' | 'http', apiKey?: string }} options
 * @returns {McpServer}
 */
export function createServer(options = {}) {
  const apiKey = options.apiKey;
  if (!apiKey) {
    throw new Error('apiKey is required to create MCP server');
  }

  const api = createApiClient(apiKey);

  const server = new McpServer({
    name: 'vcc-manager',
    version: '1.0.0',
  });

  registerWorkboardTools(server, api);
  registerJobTools(server, api);
  registerMediaTools(server, api, options);

  return server;
}
