import { z } from 'zod';

/**
 * Register project-related tools on the MCP server. (#448)
 *
 * 현재는 list_projects 만 — 파이프라인 호출의 입구로 프로젝트 ID 를 노출하는 게 핵심.
 * 프로젝트 CRUD (생성/수정/삭제/즐겨찾기) 는 자동화 needs 확인 후 별도 진입.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {(path: string, options?: object) => Promise<any>} apiRequest
 */
export function registerProjectTools(server, apiRequest) {

  // ── list_projects ─────────────────────────────────────────────────
  server.tool(
    'list_projects',
    'List the user\'s projects. Use this first to find a project ID before listing pipelines or running them.',
    {
      search: z.string().optional().describe('Search by name or description'),
    },
    async ({ search }) => {
      const result = await apiRequest('/projects', { params: { search } });
      const projects = (result?.data?.projects || []).map((p) => ({
        id: p._id,
        name: p.name,
        description: p.description || '',
        isFavorite: Boolean(p.isFavorite),
        createdAt: p.createdAt,
        // 콘텐츠 카운트 (있을 때만 — favorites endpoint 만 채워줌)
        ...(p.counts ? { counts: p.counts } : {}),
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ projects }, null, 2),
        }],
      };
    },
  );
}
