# 추가 LLM 파라미터 (JSON) 가이드

텍스트(LLM) 작업판에서 LLM 요청에 임의의 파라미터를 추가로 전달하는 기능입니다.
모델·서버마다 다른 동작(예: thinking 비활성화, 창작용 temperature)을 작업판 단위로 지정할 수 있습니다.

## 어디서 설정하나요

작업판 편집 → **LLM 파라미터** 탭 → "추가 LLM 파라미터 (JSON)" 입력칸.
(텍스트 출력 작업판에서만 보입니다. ComfyUI 이미지 작업판에는 워크플로우 탭이 그 자리에 표시됩니다.)

- JSON **객체** 형태로 입력합니다. 잘못된 JSON 은 저장이 차단됩니다.
- 비워두면 아무것도 추가하지 않고 **모델 기본값**으로 동작합니다.

## 어떻게 적용되나요

- **OpenAI / OpenAI Compatible**: 입력한 키들이 `/v1/chat/completions` **요청 본문 최상위**에 그대로 병합됩니다.
- **Gemini**: 입력한 키들이 `generateContent` 의 **`generationConfig`** 에 병합됩니다.
- `model` / `messages` / `stream` 같은 필수·스트리밍 키는 시스템 값이 항상 우선하므로 덮어쓸 수 없습니다.
- 단발 생성 · 멀티턴 대화 · 파이프라인 단계 모두 동일하게 적용됩니다.

## 자주 쓰는 레시피

### 1. 창작용 — 무작위성 높이기

```json
{ "temperature": 1.0 }
```

> 참고: 현재 시스템은 기본적으로 temperature 를 전송하지 않습니다(아래 "주의" 참고). 창작용으로 높이고 싶다면 여기서 명시적으로 지정하세요. `top_p` 도 함께 쓸 수 있습니다.
> ```json
> { "temperature": 1.0, "top_p": 0.95 }
> ```

### 2. thinking(사고 과정) 끄기 — 응답 속도 개선

사고형(reasoning) 로컬 모델은 답변 전에 긴 사고 과정을 먼저 생성해 응답이 느려집니다.
**끄는 방법은 모델·서버마다 다릅니다.** 자신의 서버에 맞는 키를 사용하세요.

- vLLM / SGLang / 다수 MLX 서버의 Qwen3 계열:
  ```json
  { "chat_template_kwargs": { "enable_thinking": false } }
  ```
- 일부 서버는 프롬프트 토큰 방식(`/no_think`)을 쓰거나 `reasoning_effort` 같은 별도 파라미터를 받습니다.
  서버 문서를 확인하세요.

### 3. 창작 + thinking off (로컬 창작 작업판 권장)

```json
{
  "temperature": 1.0,
  "chat_template_kwargs": { "enable_thinking": false }
}
```

### 4. reasoning 모델(gpt-5 / o1 / o3 등) — 비워두기

```json
{}
```

> 이 모델들은 비기본 temperature 를 거부합니다. 추가 파라미터 없이 두는 것이 안전합니다.

## 주의사항

- **temperature 는 기본적으로 전송되지 않습니다.** reasoning 모델이 커스텀 temperature 를 거부하는 사례 때문에 시스템 차원에서 빼두었습니다. 그래서 창작용으로 높이려면 이 칸에서 명시적으로 지정해야 합니다(작업판 입력 폼의 옛 temperature 항목은 실제로는 무시되던 값이라 제거되었습니다).
- **thinking 비활성화 키는 표준이 아닙니다.** 모델·서버 구현에 따라 다르므로, 한 서버에서 되는 설정이 다른 서버에서는 무시될 수 있습니다.
- 잘못된 키를 넣으면 LLM 서버가 에러를 반환하거나 조용히 무시할 수 있습니다. 변경 후 한 번 테스트해 보세요.
- `model` / `messages` / `stream` / `stream_options` 는 시스템이 관리하므로 여기서 바꿔도 적용되지 않습니다.

## 참고 — 흔히 쓰는 키

| 키 | 의미 | 비고 |
| --- | --- | --- |
| `temperature` | 무작위성(창의성). 높을수록 다양, 낮을수록 일관적 | reasoning 모델은 거부 |
| `top_p` | nucleus sampling 확률 임계값 | temperature 와 함께/대체 사용 |
| `chat_template_kwargs.enable_thinking` | Qwen3 등에서 사고 과정 on/off | 서버 의존적 |
| `reasoning_effort` | 일부 서버의 사고 강도 조절 | 서버 의존적 |
| `max_tokens` | 최대 생성 토큰 수 | 보통 미설정(모델 기본값) 권장 |
