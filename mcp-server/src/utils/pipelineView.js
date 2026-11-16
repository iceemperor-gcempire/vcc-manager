// MCP 응답용 파이프라인 단계 모양 — get_pipeline·get_pipeline_run 이 쓴다 (#1212 에서 분리, 단위 테스트용).

/** 파이프라인 정의의 단계 (populate 된 workboardId·promptEnhance.workboardId 를 받는다) */
export function pipelineStepView(s, idx) {
  return {
    index: idx,
    workboardId: s.workboardId?._id || s.workboardId,
    workboardName: s.workboardId?.name,
    outputFormat: s.workboardId?.outputFormat,
    autoInject: s.autoInject !== false,
    inputs: s.inputs || {},
    contextDocIds: s.contextDocIds || [],
    systemPromptDocId: s.systemPromptDocId || null,
    // 이미지·영상 단계가 생성 전에 텍스트 판으로 프롬프트를 늘려 쓰는지 (#1212)
    promptEnhance: s.promptEnhance?.workboardId
      ? {
        enabled: s.promptEnhance.enabled === true,
        workboardId: s.promptEnhance.workboardId?._id || s.promptEnhance.workboardId,
        workboardName: s.promptEnhance.workboardId?.name,
        inputs: s.promptEnhance.inputs || {},
        includeImages: s.promptEnhance.includeImages !== false,
      }
      : null,
    note: s.note || '',
  };
}

/** 실행 기록의 단계 */
export function runStepView(s, idx) {
  return {
    index: idx,
    workboardName: s.workboardId?.name,
    outputFormat: s.workboardId?.outputFormat,
    status: s.status,
    startedAt: s.startedAt || null,
    completedAt: s.completedAt || null,
    // 실행 기록은 error.message 에 사유를 둔다 — 예전엔 없는 errorMessage 를 읽어 실패 사유가 늘 null 이었다
    errorMessage: s.error?.message || s.errorMessage || null,
    imageGenerationJobId: s.imageGenerationJobId?._id || s.imageGenerationJobId || null,
    conversationJobId: s.conversationJobId?._id || s.conversationJobId || null,
    // text step 의 직접 출력 (텍스트). image step 은 imageGenerationJobId 로 download_result 사용.
    textOutput: s.output?.type === 'text' ? s.output.value : null,
    imageIds: s.output?.type === 'image' ? (s.output.imageIds || []) : [],
    // AI 프롬프트로 늘려 쓴 단계 (#1212) — 생성에 실제로 쓴 프롬프트. 빈 결과라 원래 프롬프트로 대신했으면 promptEnhanceFallback
    ...(s.output?.enhancedPrompt ? {
      enhancedPrompt: s.output.enhancedPrompt,
      promptEnhanceFallback: s.output.promptEnhanceFallback === true,
    } : {}),
  };
}
