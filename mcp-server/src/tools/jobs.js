import { z } from 'zod';
import { buildTextInputData } from '../utils/textInput.js';
import { applyBaseModel, findBaseModelField } from '../utils/baseModel.js';

/**
 * Register job-related tools on the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {(path: string, options?: object) => Promise<any>} apiRequest
 */
export function registerJobTools(server, apiRequest) {

  // ── generate ───────────────────────────────────────────────────────
  server.tool(
    'generate',
    'Generate an image, video or audio using a workboard (for text workboards use generate_text). Call get_workboard first to see available options. Select fields in additionalParams accept the option key (display name) or value — mapping is handled automatically.',
    {
      workboardId: z.string().describe('Workboard ID (get from list_workboards)'),
      prompt: z.string().describe('Generation prompt text'),
      aiModel: z.string().optional().describe('Base model file path, exactly as get_workboard baseModel shows it (default / options). Omit to use the workboard default. Must be inside baseModel.allowedFolders when set'),
      negativePrompt: z.string().optional().describe('Negative prompt'),
      imageSize: z.string().optional().describe('Legacy top-level image size. Prefer the size field in additionalParams (see get_workboard additionalFields)'),
      stylePreset: z.string().optional().describe('Style preset name'),
      upscaleMethod: z.string().optional().describe('Upscale method name'),
      seed: z.coerce.number().int().optional().describe('Specific seed number'),
      randomSeed: z.boolean().optional().default(true).describe('Use random seed (default true)'),
      additionalParams: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe('Additional parameters as key-value pairs (field name → value)'),
    },
    async (params) => {
      try {
        // Fetch workboard to map select values to {key, value} format
        const wbData = await apiRequest(`/workboards/${params.workboardId}`);
        const wb = wbData.workboard;

        // 텍스트 작업판은 작업 큐가 아니라 generate_text 로 돈다 (#1015) — 작업을 만들어 3초 뒤 실패시키지 않는다
        if (wb.outputFormat === 'text') return textWorkboardError(wb);

        // Helper: match select option by key (display name) first, then by value (path)
        const matchOption = (options, input) => {
          if (!options || !input) return null;
          return options.find((o) => o.key === input) || options.find((o) => o.value === input);
        };

        // Map imageSize
        let imageSize = params.imageSize;
        if (params.imageSize && wb.baseInputFields?.imageSizes) {
          const sizeOption = matchOption(wb.baseInputFields.imageSizes, params.imageSize);
          if (sizeOption) {
            imageSize = { key: sizeOption.key, value: sizeOption.value };
          }
        }

        // Map stylePreset
        let stylePreset = params.stylePreset;
        if (params.stylePreset && wb.baseInputFields?.stylePresets) {
          const presetOption = matchOption(wb.baseInputFields.stylePresets, params.stylePreset);
          if (presetOption) {
            stylePreset = { key: presetOption.key, value: presetOption.value };
          }
        }

        // Map upscaleMethod
        let upscaleMethod = params.upscaleMethod;
        if (params.upscaleMethod && wb.baseInputFields?.upscaleMethods) {
          const upscaleOption = matchOption(wb.baseInputFields.upscaleMethods, params.upscaleMethod);
          if (upscaleOption) {
            upscaleMethod = { key: upscaleOption.key, value: upscaleOption.value };
          }
        }

        // Map additionalParams (select fields match by key or value, image fields need { imageId } format)
        let additionalParams = params.additionalParams || {};
        if (Object.keys(additionalParams).length > 0 && wb.additionalInputFields) {
          const mapped = { ...additionalParams };
          for (const field of wb.additionalInputFields) {
            const val = additionalParams[field.name];
            if (val !== undefined && field.type === 'select' && field.options) {
              const option = matchOption(field.options, String(val));
              if (option) {
                mapped[field.name] = { key: option.key, value: option.value };
              }
            }
            if (val !== undefined && field.type === 'image') {
              mapped[field.name] = { imageId: String(val) };
            }
          }
          additionalParams = mapped;
        }

        // 베이스 모델 (#1088) — aiModel 을 판의 베이스 모델 칸에 넣는다 (없으면 칸 기본값). 필수 칸 검사보다 먼저 해야
        // 모든 배포 판의 필수 칸 base_model 이 "빠졌다" 로 막히지 않는다
        const model = applyBaseModel(wb, additionalParams, params.aiModel);
        additionalParams = model.additionalParams;

        // Validate required additionalFields (#136)
        if (wb.additionalInputFields) {
          const missingFields = wb.additionalInputFields
            .filter((field) => field.required && (additionalParams[field.name] === undefined || additionalParams[field.name] === ''));
          if (missingFields.length > 0) {
            const missing = missingFields.map((field) => `${field.name} ("${field.label}")`);
            // 모델 칸이 비는 건 기본값 없는 판에서 aiModel 을 안 줬을 때뿐이다 — aiModel 로 넣으라고 알린다
            const modelField = findBaseModelField(wb);
            const modelHint = modelField && missingFields.some((f) => f.name === modelField.name)
              ? ` This workboard has no default base model — pass aiModel (see get_workboard baseModel).`
              : '';
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: `Missing required additional parameters: ${missing.join(', ')}. Use additionalParams to provide them. Check get_workboard for available options.${modelHint}`,
                }, null, 2),
              }],
              isError: true,
            };
          }
        }

        const payload = {
          workboardId: params.workboardId,
          prompt: params.prompt,
          aiModel: model.aiModel,
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
              ...(model.warnings.length > 0 ? { warnings: model.warnings } : {}),
            }, null, 2),
          }],
        };
      } catch (error) {
        console.error(`[MCP] generate failed:`, error.message);
        throw error;
      }
    },
  );

  // ── generate_text ──────────────────────────────────────────────────
  // 텍스트 작업판 (#1015). 웹 화면과 같은 /jobs/generate-prompt 를 부르고 결과를 바로 돌려준다.
  server.tool(
    'generate_text',
    'Run a text workboard (outputFormat "text" — chat / prompt writer LLM boards) and return the generated text directly. Attach images with imageIds (upload_image first) when the workboard has an image field. Pass conversationId from a previous result to continue the same conversation. Field defaults from the workboard are applied automatically. Local LLMs can take minutes.',
    {
      workboardId: z.string().describe('Text workboard ID (list_workboards with outputFormat "text")'),
      prompt: z.string().describe('User message'),
      imageIds: z.array(z.string()).optional().describe('Image IDs from upload_image (vision models; up to the workboard image field limit)'),
      model: z.string().optional().describe('Model ID to use instead of the workboard default'),
      conversationId: z.string().optional().describe('Continue this conversation (from a previous generate_text result)'),
      additionalParams: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe('Other workboard fields (field name → value), e.g. system_prompt, temperature'),
    },
    async (params) => {
      const wbData = await apiRequest(`/workboards/${params.workboardId}`);
      const wb = wbData.workboard;
      if (wb.outputFormat !== 'text') {
        return errorResult(`"${wb.name}" 은 텍스트 작업판이 아닙니다 (outputFormat=${wb.outputFormat}). generate 를 쓰세요.`);
      }

      let inputData;
      try {
        inputData = buildTextInputData(wb, params);
      } catch (error) {
        return errorResult(error.message);
      }

      const data = await apiRequest('/jobs/generate-prompt', {
        method: 'POST',
        body: { workboardId: params.workboardId, inputData, conversationId: params.conversationId },
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            result: data.result,
            conversationId: data.conversationId,
            model: data.model,
            usage: data.usage,
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
      aiModel: z.string().optional().describe('Override the base model file path (see get_workboard baseModel of the target workboard). Omit to keep the original job\'s model'),
      imageSize: z.string().optional().describe('Override image size name'),
      seed: z.coerce.number().int().optional().describe('Override seed value'),
      randomSeed: z.boolean().optional().describe('Use random seed (default true)'),
      additionalParams: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
        .describe('Override additional parameters (only specified keys are overridden, rest are matched from original)'),
    },
    async (params) => {
      try {
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
        if (wb.outputFormat === 'text') return textWorkboardError(wb);

        // Helper: match a select option by key (display name) first, then by value
        const matchSelectValue = (options, inputValue) => {
          if (!options || !inputValue) return null;
          const key = typeof inputValue === 'object' ? inputValue.key : inputValue;
          const val = typeof inputValue === 'object' ? inputValue.value : inputValue;

          // Match by key (display name) first
          let match = options.find((o) => o.key === key);
          // Fallback: match by value
          if (!match && val) {
            match = options.find((o) => o.value === val);
          }
          return match ? { key: match.key, value: match.value } : null;
        };

        // 3. Smart field matching

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

            if (field.type === 'image') {
              // 이미 { imageId } 형식이면 그대로, 문자열이면 변환
              additionalParams[field.name] = typeof inputVal === 'object' && inputVal.imageId
                ? inputVal
                : { imageId: String(inputVal) };
              continue;
            }

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

        // 베이스 모델 (#1088) — aiModel 을 주면 원래 작업의 모델 대신 그 값을 칸에 넣는다. 칸 값을 additionalParams 로
        // 직접 덮었으면 그쪽이 우선. 예전에는 없어진 baseInputFields 를 보느라 aiModel 덮어쓰기가 그냥 버려졌다
        const isCrossWorkboard = targetWorkboardId !== originalWorkboardId;
        const modelField = findBaseModelField(wb);
        if (modelField && params.aiModel && overrideAdditional[modelField.name] === undefined) {
          delete additionalParams[modelField.name];
        }
        // 칸이 없는 판(d-ice-all 등)은 top-level aiModel 을 읽는다 — 같은 판으로 이어 갈 때만 원래 값을 넘긴다
        const model = applyBaseModel(
          wb,
          additionalParams,
          params.aiModel ?? (modelField || isCrossWorkboard ? undefined : inputData.aiModel),
        );
        Object.assign(additionalParams, model.additionalParams);

        // Validate required additionalFields (#136)
        if (wb.additionalInputFields) {
          const missing = wb.additionalInputFields
            .filter((field) => field.required && (additionalParams[field.name] === undefined || additionalParams[field.name] === ''))
            .map((field) => `${field.name} ("${field.label}")`);
          if (missing.length > 0) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: `Missing required additional parameters: ${missing.join(', ')}. Use additionalParams to provide them. Check get_workboard for available options.`,
                }, null, 2),
              }],
              isError: true,
            };
          }
        }

        // 4. Build payload
        const prompt = params.prompt || inputData.prompt;
        const negativePrompt = params.negativePrompt !== undefined
          ? params.negativePrompt : inputData.negativePrompt;

        const payload = {
          workboardId: targetWorkboardId,
          prompt,
          aiModel: model.aiModel,
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
        const matchReport = {
          sourceJob: params.jobId,
          sourceWorkboard: job.workboardId?.name || originalWorkboardId,
          targetWorkboard: wb.name,
          crossWorkboard: isCrossWorkboard,
          matchedFields: [],
        };

        if (model.aiModel) matchReport.matchedFields.push(`aiModel: ${model.aiModel}`);
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
              ...(model.warnings.length > 0 ? { warnings: model.warnings } : {}),
            }, null, 2),
          }],
        };
      } catch (error) {
        console.error(`[MCP] continue_job failed (jobId=${params.jobId}):`, error.message);
        throw error;
      }
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
        // 오디오 출력 (#805)
        result.resultAudios = (job.resultAudios || []).map((aud) => ({
          id: aud._id,
          filename: aud.originalName,
          size: aud.size,
          duration: aud.metadata?.duration,
        }));
      }

      if (job.status === 'failed') {
        result.error = job.error;
        console.error(`[MCP] Job ${jobId} failed:`, job.error?.message || 'Unknown error', job.error?.code ? `(${job.error.code})` : '');
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
      page: z.coerce.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.coerce.number().int().positive().max(50).optional().describe('Items per page (default 10)'),
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
        resultAudios: (job.resultAudios || []).length,
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

function errorResult(message) {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

function textWorkboardError(wb) {
  return errorResult(`"${wb.name}" 은 텍스트 작업판입니다. generate 대신 generate_text 를 쓰세요.`);
}
