// 작업판의 베이스 모델이 어느 폴더에서 로드되는지 추론 (#898).
//
// 모델 캐시는 `source: 'checkpoints' | 'diffusion_models'` 를 갖지만 picker 는 두 폴더를 합쳐
// 보여 줬다. UNETLoader 판에서 AIO 체크포인트를 고르면 ComfyUI 가 value_not_in_list 로 실패하는데,
// 사용자는 그 이유를 알 수 없다. 워크플로에서 base_model placeholder 를 소비하는 로더 노드의
// class_type 으로 폴더를 알아내 picker 를 거른다. 순수 함수.

const CHECKPOINT_LOADERS = /^(CheckpointLoader|CheckpointLoaderSimple|ImageOnlyCheckpointLoader|unCLIPCheckpointLoader|CheckpointLoaderNF4|Checkpoint Loader.*)$/;
const UNET_LOADERS = /^(UNETLoader|UnetLoaderGGUF|UnetLoaderGGUFAdvanced|UNETLoaderNF4|DualCLIPLoaderGGUF|MultiGPU.*UNET.*|LoadDiffusionModel.*)$/;

/**
 * @param {string|Object} workflowData — API 포맷 워크플로 (문자열 또는 객체)
 * @param {string} placeholder — 예: '{{##base_model##}}'
 * @returns {'checkpoints'|'diffusion_models'|null} 판단 불가(placeholder 미사용·알 수 없는 노드·파싱 실패)면 null
 */
function inferBaseModelSource(workflowData, placeholder = '{{##base_model##}}') {
  if (!workflowData || !placeholder) return null;
  let wf = workflowData;
  if (typeof wf === 'string') {
    try { wf = JSON.parse(wf); } catch { return null; }
  }
  if (!wf || typeof wf !== 'object') return null;

  const consumers = Object.values(wf).filter((n) => n && n.inputs && Object.values(n.inputs).some((v) => v === placeholder));
  const sources = new Set();
  for (const n of consumers) {
    const ct = String(n.class_type || '');
    if (CHECKPOINT_LOADERS.test(ct)) sources.add('checkpoints');
    else if (UNET_LOADERS.test(ct)) sources.add('diffusion_models');
  }
  // 두 종류가 섞여 있으면(비정상) 거르지 않는다 — 잘못 거르는 것보다 다 보여 주는 게 안전
  return sources.size === 1 ? [...sources][0] : null;
}

module.exports = { inferBaseModelSource, CHECKPOINT_LOADERS, UNET_LOADERS };
