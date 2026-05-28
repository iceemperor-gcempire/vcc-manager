import { z } from 'zod';

/**
 * Register pipeline + pipeline-run tools (#448).
 *
 * Flow: list_projects → list_pipelines → run_pipeline → get_pipeline_run (poll)
 *       → download_result (existing media tool) 로 산출물 회수.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {(path: string, options?: object) => Promise<any>} apiRequest
 */
export function registerPipelineTools(server, apiRequest) {

  // ── list_pipelines ─────────────────────────────────────────────────
  server.tool(
    'list_pipelines',
    'List pipelines in a project. Call list_projects first to obtain projectId.',
    {
      projectId: z.string().describe('Project ID (from list_projects)'),
    },
    async ({ projectId }) => {
      const result = await apiRequest(`/projects/${projectId}/pipelines`);
      const pipelines = (result?.data?.pipelines || []).map((p) => ({
        id: p._id,
        name: p.name,
        description: p.description || '',
        stepCount: (p.steps || []).length,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ pipelines }, null, 2),
        }],
      };
    },
  );

  // ── get_pipeline ───────────────────────────────────────────────────
  server.tool(
    'get_pipeline',
    'Get pipeline details including step composition (workboards used, autoInject, pre-filled inputs, attached docs). Useful to inspect before running.',
    {
      projectId: z.string().describe('Project ID'),
      pipelineId: z.string().describe('Pipeline ID (from list_pipelines)'),
    },
    async ({ projectId, pipelineId }) => {
      const result = await apiRequest(`/projects/${projectId}/pipelines/${pipelineId}`);
      const p = result?.data?.pipeline;
      if (!p) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: '파이프라인을 찾을 수 없음' }) }],
        };
      }
      const detail = {
        id: p._id,
        name: p.name,
        description: p.description || '',
        steps: (p.steps || []).map((s, idx) => ({
          index: idx,
          workboardId: s.workboardId?._id || s.workboardId,
          workboardName: s.workboardId?.name,
          outputFormat: s.workboardId?.outputFormat,
          autoInject: s.autoInject !== false,
          inputs: s.inputs || {},
          contextDocIds: s.contextDocIds || [],
          systemPromptDocId: s.systemPromptDocId || null,
          note: s.note || '',
        })),
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(detail, null, 2),
        }],
      };
    },
  );

  // ── run_pipeline ───────────────────────────────────────────────────
  server.tool(
    'run_pipeline',
    'Start a new pipeline run with an optional initial prompt. Returns runId — poll get_pipeline_run for progress.',
    {
      projectId: z.string().describe('Project ID'),
      pipelineId: z.string().describe('Pipeline ID'),
      initialPrompt: z.string().optional().describe('Initial prompt for step 0 (텍스트 입력). 비우면 빈 문자열.'),
    },
    async ({ projectId, pipelineId, initialPrompt = '' }) => {
      const result = await apiRequest(`/projects/${projectId}/pipeline-runs`, {
        method: 'POST',
        body: { pipelineId, initialPrompt },
      });
      const run = result?.data?.run;
      if (!run) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'run 생성 실패' }) }],
        };
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            runId: run._id,
            status: run.status,
            startedAt: run.startedAt || run.createdAt,
            stepCount: (run.steps || []).length,
          }, null, 2),
        }],
      };
    },
  );

  // ── get_pipeline_run ───────────────────────────────────────────────
  server.tool(
    'get_pipeline_run',
    'Get pipeline run status and per-step outputs. Poll this after run_pipeline until status is completed or failed.',
    {
      projectId: z.string().describe('Project ID'),
      runId: z.string().describe('Pipeline run ID (from run_pipeline)'),
    },
    async ({ projectId, runId }) => {
      const result = await apiRequest(`/projects/${projectId}/pipeline-runs/${runId}`);
      const run = result?.data?.run;
      if (!run) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'run 을 찾을 수 없음' }) }],
        };
      }

      const summary = {
        runId: run._id,
        pipelineName: run.pipelineId?.name,
        status: run.status,
        startedAt: run.startedAt || run.createdAt,
        completedAt: run.completedAt || null,
        errorMessage: run.errorMessage || null,
        initialPrompt: run.initialPrompt || '',
        steps: (run.steps || []).map((s, idx) => ({
          index: idx,
          workboardName: s.workboardId?.name,
          outputFormat: s.workboardId?.outputFormat,
          status: s.status,
          startedAt: s.startedAt || null,
          completedAt: s.completedAt || null,
          errorMessage: s.errorMessage || null,
          imageGenerationJobId: s.imageGenerationJobId?._id || s.imageGenerationJobId || null,
          conversationJobId: s.conversationJobId?._id || s.conversationJobId || null,
          // text step 의 직접 출력 (텍스트). image step 은 imageGenerationJobId 로 download_result 사용.
          textOutput: s.output?.type === 'text' ? s.output.value : null,
          imageIds: s.output?.type === 'image' ? (s.output.imageIds || []) : [],
        })),
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        }],
      };
    },
  );

  // ── list_pipeline_runs ─────────────────────────────────────────────
  server.tool(
    'list_pipeline_runs',
    'List recent pipeline runs in a project (most recent first).',
    {
      projectId: z.string().describe('Project ID'),
      pipelineId: z.string().optional().describe('Filter to a specific pipeline'),
      limit: z.coerce.number().int().positive().max(50).optional().describe('Items per page (default 20)'),
      page: z.coerce.number().int().positive().optional().describe('Page number (default 1)'),
    },
    async ({ projectId, pipelineId, limit, page }) => {
      const result = await apiRequest(`/projects/${projectId}/pipeline-runs`, {
        params: { pipelineId, limit, page },
      });
      const runs = (result?.data?.runs || []).map((r) => ({
        runId: r._id,
        pipelineId: r.pipelineId?._id || r.pipelineId,
        pipelineName: r.pipelineId?.name,
        status: r.status,
        startedAt: r.startedAt || r.createdAt,
        completedAt: r.completedAt || null,
        stepCount: (r.steps || []).length,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            runs,
            pagination: result?.data?.pagination,
          }, null, 2),
        }],
      };
    },
  );
}
