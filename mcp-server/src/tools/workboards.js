import { z } from 'zod';
import { SERVER_TYPES, OUTPUT_FORMATS } from '../constants/serverTypes.js';
import { describeBaseModel } from '../utils/baseModel.js';

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
      serverType: z.enum(SERVER_TYPES).optional().describe('Filter by server type'),
      outputFormat: z.enum(OUTPUT_FORMATS).optional().describe('Filter by output format'),
      page: z.coerce.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.coerce.number().int().positive().max(50).optional().describe('Items per page (default 10)'),
    },
    async ({ search, serverType, outputFormat, page, limit }) => {
      const data = await apiRequest('/workboards', {
        params: { search, serverType, outputFormat, page, limit },
      });

      const workboards = data.workboards.map((wb) => ({
        id: wb._id,
        name: wb.name,
        description: wb.description || '',
        serverType: wb.serverId?.serverType,
        outputFormat: wb.outputFormat,
        server: wb.serverId?.name || 'Unknown',
        // 텍스트 작업판은 generate_text 로 실행한다 (#1015)
        runWith: wb.outputFormat === 'text' ? 'generate_text' : 'generate',
        // 베이스 모델 칸의 기본값 (#1088). 칸이 없는 판은 null — 고를 수 있는 범위는 get_workboard
        defaultModel: describeBaseModel(wb)?.default ?? null,
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
    'Get workboard details: the base model (default, allowed folders, and the selectable list when the workboard restricts models to a whitelist) and every input field with its options. Call this before generate to understand required parameters.',
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
        serverType: wb.serverId?.serverType,
        outputFormat: wb.outputFormat,
        server: wb.serverId?.name || 'Unknown',
        // 텍스트 작업판은 generate_text 로 실행한다 (#1015)
        runWith: wb.outputFormat === 'text' ? 'generate_text' : 'generate',

        // 베이스 모델 (#1088) — generate 의 aiModel 로 넘긴다 (생략하면 default). 칸이 없는 판은 null.
        // 예전에는 v2 에서 없어진 baseInputFields 를 읽어 모델·크기·스타일·업스케일 목록이 늘 비어 있었다.
        // 크기 같은 선택 칸은 아래 additionalFields 의 options 에 있다.
        baseModel: describeBaseModel(wb),

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
          ...(f.type === 'image' ? { maxImages: f.imageConfig?.maxImages || 1 } : {}),
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
