import { z } from 'zod';

/**
 * Register workboard-related tools on the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {(path: string, options?: object) => Promise<any>} apiRequest
 */
export function registerWorkboardTools(server, apiRequest) {

  // ── list_workboards ────────────────────────────────────────────────
  server.tool(
    'list_workboards',
    'List available workboards (image/video generation templates). Use this first to discover what generators are available.',
    {
      search: z.string().optional().describe('Search by name or description'),
      apiFormat: z.enum(['ComfyUI', 'OpenAI Compatible']).optional().describe('Filter by API format'),
      outputFormat: z.enum(['image', 'video', 'text']).optional().describe('Filter by output format'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().max(50).optional().describe('Items per page (default 10)'),
    },
    async ({ search, apiFormat, outputFormat, page, limit }) => {
      const data = await apiRequest('/workboards', {
        params: { search, apiFormat, outputFormat, page, limit },
      });

      const workboards = data.workboards.map((wb) => ({
        id: wb._id,
        name: wb.name,
        description: wb.description || '',
        apiFormat: wb.apiFormat,
        outputFormat: wb.outputFormat,
        server: wb.serverId?.name || 'Unknown',
        models: (wb.baseInputFields?.aiModel || []).map((m) => m.key).join(', '),
        sizes: (wb.baseInputFields?.imageSizes || []).map((s) => s.key).join(', '),
        usageCount: wb.usageCount,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            workboards,
            pagination: data.pagination,
          }, null, 2),
        }],
      };
    },
  );

  // ── get_workboard ──────────────────────────────────────────────────
  server.tool(
    'get_workboard',
    'Get workboard details including available models, sizes, and input fields. Call this before generate to understand required parameters.',
    {
      workboardId: z.string().describe('Workboard ID'),
    },
    async ({ workboardId }) => {
      const data = await apiRequest(`/workboards/${workboardId}`);
      const wb = data.workboard;

      const guide = {
        id: wb._id,
        name: wb.name,
        description: wb.description || '',
        apiFormat: wb.apiFormat,
        outputFormat: wb.outputFormat,
        server: wb.serverId?.name || 'Unknown',

        // Base input fields guide (use these values in generate parameters)
        aiModel: {
          required: true,
          options: (wb.baseInputFields?.aiModel || []).map((m) => m.key),
        },
        imageSizes: {
          required: false,
          options: (wb.baseInputFields?.imageSizes || []).map((s) => s.key),
        },
        stylePresets: {
          available: (wb.baseInputFields?.stylePresets || []).length > 0,
          options: (wb.baseInputFields?.stylePresets || []).map((p) => p.key),
        },
        upscaleMethods: {
          available: (wb.baseInputFields?.upscaleMethods || []).length > 0,
          options: (wb.baseInputFields?.upscaleMethods || []).map((u) => u.key),
        },

        // Additional custom fields
        additionalFields: (wb.additionalInputFields || []).map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          description: f.description || '',
          defaultValue: f.defaultValue,
          ...(f.type === 'select' ? {
            options: (f.options || []).map((o) => o.key),
          } : {}),
          ...(f.type === 'number' && f.validation ? {
            min: f.validation.min,
            max: f.validation.max,
          } : {}),
        })),

        // Prompt fields
        promptRequired: true,
        negativePromptSupported: true,
        seedSupported: true,
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(guide, null, 2),
        }],
      };
    },
  );
}
