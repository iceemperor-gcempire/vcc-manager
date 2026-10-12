// 프롬프트 칸을 보일지 (#1035).
// 백엔드가 워크플로에서 실제로 쓰는 내장 입력을 계산해 내려준다 (#820, supportedInputs).
// ComfyUI 판이 `{{##prompt##}}` 를 쓰지 않으면(예: H3 업샘플러 영상 업스케일) 프롬프트 칸을 숨기고 비워서 생성한다.
// OpenAI·Gemini 등 API 판은 워크플로 없이 서비스가 프롬프트를 직접 쓰므로 항상 보인다.
// supportedInputs 가 없는 예전 응답도 보인다 — 감추는 쪽이 안전한 기본값이 아니다.
export function isPromptHidden({ serverType, supportedInputs } = {}) {
  return serverType === 'ComfyUI' && !!supportedInputs && supportedInputs.prompt === false;
}
