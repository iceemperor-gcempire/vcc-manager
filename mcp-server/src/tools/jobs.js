import { z } from 'zod';
import { apiRequest } from '../utils/apiClient.js';

/**
 * Register job-related tools on the MCP server.
 */
export function registerJobTools(server) {

  // ── generate ───────────────────────────────────────────────────────
  server.tool(
    'generate',
    'Generate an image or video using a workboard. Call get_workboard first to see available options. Select fields (aiModel, imageSize, etc.) only need the "value" string — key-value mapping is handled automatically.',
    {
      workboardId: z.string().describe('Workboard ID (get from list_workboards)'),
      prompt: z.string().describe('Generation prompt text'),
      aiModel: z.string().describe('AI model value (from get_workboard aiModel options)'),
      negativePrompt: z.string().optional().describe('Negative prompt'),
      imageSize: z.string().optional().describe('Image size value (from get_workboard imageSizes options)'),
      stylePreset: z.string().optional().describe('Style preset value'),
      upscaleMethod: z.string().optional().describe('Upscale method value'),
      seed: z.number().int().optional().describe('Specific seed number'),
      randomSeed: z.boolean().optional().default(true).describe('Use random seed (default true)'),
      additionalParams: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe('Additional parameters as key-value pairs (field name → value)'),
    },
    async (params) => {
      // Fetch workboard to map select values to {key, value} format
      const wbData = await apiRequest(`/workboards/${params.workboardId}`);
      const wb = wbData.workboard;

      // Map aiModel
      let aiModel = params.aiModel;
      const modelOption = wb.baseInputFields?.aiModel?.find((m) => m.value === params.aiModel);
      if (modelOption) {
        aiModel = { key: modelOption.key, value: modelOption.value };
      }

      // Map imageSize
      let imageSize = params.imageSize;
      if (params.imageSize && wb.baseInputFields?.imageSizes) {
        const sizeOption = wb.baseInputFields.imageSizes.find((s) => s.value === params.imageSize);
        if (sizeOption) {
          imageSize = { key: sizeOption.key, value: sizeOption.value };
        }
      }

      // Map stylePreset
      let stylePreset = params.stylePreset;
      if (params.stylePreset && wb.baseInputFields?.stylePresets) {
        const presetOption = wb.baseInputFields.stylePresets.find((p) => p.value === params.stylePreset);
        if (presetOption) {
          stylePreset = { key: presetOption.key, value: presetOption.value };
        }
      }

      // Map upscaleMethod
      let upscaleMethod = params.upscaleMethod;
      if (params.upscaleMethod && wb.baseInputFields?.upscaleMethods) {
        const upscaleOption = wb.baseInputFields.upscaleMethods.find((u) => u.value === params.upscaleMethod);
        if (upscaleOption) {
          upscaleMethod = { key: upscaleOption.key, value: upscaleOption.value };
        }
      }

      // Map additionalParams (select fields need key-value mapping)
      let additionalParams = params.additionalParams || {};
      if (Object.keys(additionalParams).length > 0 && wb.additionalInputFields) {
        const mapped = { ...additionalParams };
        for (const field of wb.additionalInputFields) {
          const val = additionalParams[field.name];
          if (val !== undefined && field.type === 'select' && field.options) {
            const option = field.options.find((o) => o.value === String(val));
            if (option) {
              mapped[field.name] = { key: option.key, value: option.value };
            }
          }
        }
        additionalParams = mapped;
      }

      const payload = {
        workboardId: params.workboardId,
        prompt: params.prompt,
        aiModel,
        negativePrompt: params.negativePrompt,
        imageSize,
        stylePreset,
        upscaleMethod,
        additionalParams,
        seed: params.seed,
        randomSeed: params.randomSeed ?? true,
      };

      const data = await apiRequest('/jobs/generate', {
        method: 'POST',
        body: payload,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            jobId: data.job.id,
            status: data.job.status,
            message: data.message,
          }, null, 2),
        }],
      };
    },
  );

  // ── continue_job ──────────────────────────────────────────────────
  server.tool(
    'continue_job',
    'Continue a completed/failed job on the same or a different workboard. Automatically matches parameters (prompt, aiModel, imageSize, additionalParams) from the original job to the target workboard via smart field matching. You can override any parameter.',
    {
      jobId: z.string().describe('Source job ID to continue from'),
      targetWorkboardId: z.string().optional().describe('Target workboard ID. If omitted, uses the original workboard.'),
      prompt: z.string().optional().describe('Override prompt (uses original if omitted)'),
      negativePrompt: z.string().optional().describe('Override negative prompt'),
      aiModel: z.string().optional().describe('Override AI model value'),
      imageSize: z.string().optional().describe('Override image size value'),
      seed: z.number().int().optional().describe('Override seed value'),
      randomSeed: z.boolean().optional().describe('Use random seed (default true)'),
      additionalParams: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe('Override additional parameters (only specified keys are overridden, rest are matched from original)'),
    },
    async (params) => {
      // 1. Fetch original job
      const jobData = await apiRequest(`/jobs/${params.jobId}`);
      const job = jobData.job;
      const inputData = job.inputData || {};

      // Determine target workboard
      const originalWorkboardId = typeof job.workboardId === 'object'
        ? job.workboardId._id : job.workboardId;
      const targetWorkboardId = params.targetWorkboardId || originalWorkboardId;

      // 2. Fetch target workboard
      const wbData = await apiRequest(`/workboards/${targetWorkboardId}`);
      const wb = wbData.workboard;

      // Helper: match a select value by value first, then by key
      const matchSelectValue = (options, inputValue) => {
        if (!options || !inputValue) return null;
        const val = typeof inputValue === 'object' ? inputValue.value : inputValue;
        const key = typeof inputValue === 'object' ? inputValue.key : inputValue;

        // Match by value first
        let match = options.find((o) => o.value === val);
        // Fallback: match by key
        if (!match && key) {
          match = options.find((o) => o.key === key);
        }
        return match ? { key: match.key, value: match.value } : null;
      };

      // 3. Smart field matching

      // AI Model
      const rawAiModel = params.aiModel || inputData.aiModel;
      let aiModel;
      if (rawAiModel && wb.baseInputFields?.aiModel) {
        aiModel = matchSelectValue(wb.baseInputFields.aiModel, rawAiModel);
        if (!aiModel) {
          // Fallback to first option
          const first = wb.baseInputFields.aiModel[0];
          if (first) aiModel = { key: first.key, value: first.value };
        }
      }

      // Image Size
      const rawImageSize = params.imageSize || inputData.imageSize;
      let imageSize;
      if (rawImageSize && wb.baseInputFields?.imageSizes) {
        imageSize = matchSelectValue(wb.baseInputFields.imageSizes, rawImageSize);
        if (!imageSize) {
          const first = wb.baseInputFields.imageSizes[0];
          if (first) imageSize = { key: first.key, value: first.value };
        }
      }

      // Style Preset
      let stylePreset;
      if (inputData.stylePreset && wb.baseInputFields?.stylePresets) {
        stylePreset = matchSelectValue(wb.baseInputFields.stylePresets, inputData.stylePreset);
      }

      // Upscale Method
      let upscaleMethod;
      if (inputData.upscaleMethod && wb.baseInputFields?.upscaleMethods) {
        upscaleMethod = matchSelectValue(wb.baseInputFields.upscaleMethods, inputData.upscaleMethod);
      }

      // Additional Params: match from original, then apply overrides
      const additionalParams = {};
      const originalAdditional = inputData.additionalParams || {};
      const overrideAdditional = params.additionalParams || {};

      if (wb.additionalInputFields) {
        for (const field of wb.additionalInputFields) {
          // Check override first, then original
          const overrideVal = overrideAdditional[field.name];
          const originalVal = originalAdditional[field.name];
          const inputVal = overrideVal !== undefined ? overrideVal : originalVal;

          if (inputVal === undefined) continue;

          if (field.type === 'select' && field.options) {
            const matched = matchSelectValue(field.options, inputVal);
            if (matched) {
              additionalParams[field.name] = matched;
            } else {
              // Fallback to default or first option
              const fallback = field.defaultValue || field.options[0]?.value;
              if (fallback) {
                const fallbackOption = field.options.find((o) => o.value === fallback);
                if (fallbackOption) {
                  additionalParams[field.name] = { key: fallbackOption.key, value: fallbackOption.value };
                }
              }
            }
          } else {
            additionalParams[field.name] = inputVal;
          }
        }
      }

      // 4. Build payload
      const prompt = params.prompt || inputData.prompt;
      const negativePrompt = params.negativePrompt !== undefined
        ? params.negativePrompt : inputData.negativePrompt;

      const payload = {
        workboardId: targetWorkboardId,
        prompt,
        aiModel,
        negativePrompt,
        imageSize,
        stylePreset,
        upscaleMethod,
        additionalParams,
        seed: params.seed !== undefined ? params.seed : inputData.seed,
        randomSeed: params.randomSeed ?? true,
        ...(inputData.tags?.length > 0 && { tags: inputData.tags }),
      };

      // 5. Submit new job
      const data = await apiRequest('/jobs/generate', {
        method: 'POST',
        body: payload,
      });

      // 6. Build matching report
      const isCrossWorkboard = targetWorkboardId !== originalWorkboardId;
      const matchReport = {
        sourceJob: params.jobId,
        sourceWorkboard: job.workboardId?.name || originalWorkboardId,
        targetWorkboard: wb.name,
        crossWorkboard: isCrossWorkboard,
        matchedFields: [],
      };

      if (aiModel) matchReport.matchedFields.push(`aiModel: ${aiModel.key}`);
      if (imageSize) matchReport.matchedFields.push(`imageSize: ${imageSize.key}`);
      if (stylePreset) matchReport.matchedFields.push(`stylePreset: ${stylePreset.key}`);
      if (upscaleMethod) matchReport.matchedFields.push(`upscaleMethod: ${upscaleMethod.key}`);
      Object.keys(additionalParams).forEach((k) => {
        const v = additionalParams[k];
        matchReport.matchedFields.push(`${k}: ${typeof v === 'object' ? v.key : v}`);
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            jobId: data.job.id,
            status: data.job.status,
            message: data.message,
            matching: matchReport,
          }, null, 2),
        }],
      };
    },
  );

  // ── get_job_status ─────────────────────────────────────────────────
  server.tool(
    'get_job_status',
    'Check the status of a generation job. Poll this after generate to wait for completion.',
    {
      jobId: z.string().describe('Job ID (from generate result)'),
    },
    async ({ jobId }) => {
      const data = await apiRequest(`/jobs/${jobId}`);
      const job = data.job;

      const result = {
        id: job._id,
        status: job.status,
        progress: job.progress,
        prompt: job.inputData?.prompt,
        workboard: job.workboardId?.name || 'Unknown',
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      };

      if (job.status === 'completed') {
        result.resultImages = (job.resultImages || []).map((img) => ({
          id: img._id,
          filename: img.originalName,
          size: img.size,
        }));
        result.resultVideos = (job.resultVideos || []).map((vid) => ({
          id: vid._id,
          filename: vid.originalName,
          size: vid.size,
        }));
      }

      if (job.status === 'failed') {
        result.error = job.error;
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // ── list_jobs ──────────────────────────────────────────────────────
  server.tool(
    'list_jobs',
    'List your generation jobs with optional filtering.',
    {
      status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional()
        .describe('Filter by job status'),
      search: z.string().optional().describe('Search in prompts'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().max(50).optional().describe('Items per page (default 10)'),
    },
    async ({ status, search, page, limit }) => {
      const data = await apiRequest('/jobs/my', {
        params: { status, search, page, limit },
      });

      const jobs = data.jobs.map((job) => ({
        id: job._id,
        status: job.status,
        prompt: job.inputData?.prompt?.substring(0, 100) || '',
        workboard: job.workboardId?.name || 'Unknown',
        resultImages: (job.resultImages || []).length,
        resultVideos: (job.resultVideos || []).length,
        createdAt: job.createdAt,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            jobs,
            pagination: data.pagination,
          }, null, 2),
        }],
      };
    },
  );
}
