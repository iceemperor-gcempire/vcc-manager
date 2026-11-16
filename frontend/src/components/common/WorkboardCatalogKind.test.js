/**
 * 작업판 카드의 종류 라벨 (#1223)
 *
 * ComfyUI 이미지 판은 모델과 관계없이 전부 "SDXL" 로 나왔다 (v1 시절 이름).
 * Krea 2 · Z-Image · Qwen-Image 판도 SDXL 로 보여 "이미지 (ComfyUI)" 로 바꿨다.
 * 영상 판도 전부 "영상 (I2V)" 여서 R2V·T2V 판까지 I2V 로 보였다 — "영상 생성" 으로 바꿨다.
 */
import { KIND_META, deriveKind } from './WorkboardCatalog';

const label = (wb) => KIND_META[deriveKind(wb)].label;

describe('작업판 종류 라벨 (#1223)', () => {
  test('ComfyUI 이미지 판은 "이미지 (ComfyUI)" — SDXL 이 아니다', () => {
    expect(label({ outputFormat: 'image', serverId: { serverType: 'ComfyUI' } })).toBe('이미지 (ComfyUI)');
    expect(label({ outputFormat: 'image', serverType: 'ComfyUI' })).toBe('이미지 (ComfyUI)');
  });

  test('API 이미지 판은 "이미지 (API)"', () => {
    expect(label({ outputFormat: 'image', serverId: { serverType: 'OpenAI' } })).toBe('이미지 (API)');
    expect(label({ outputFormat: 'image', serverId: { serverType: 'Gemini' } })).toBe('이미지 (API)');
  });

  test('영상 판은 "영상 생성" — R2V·T2V·FL2V 판도 I2V 로 나오던 것을 바꿨다', () => {
    expect(label({ outputFormat: 'video', serverId: { serverType: 'ComfyUI' } })).toBe('영상 생성');
  });

  test('다른 출력 형식은 그대로다', () => {
    expect(label({ outputFormat: 'text' })).toBe('텍스트 생성');
    expect(label({ outputFormat: 'audio' })).toBe('오디오 생성');
  });

  test('어떤 판도 SDXL · I2V 라벨을 받지 않는다', () => {
    const labels = Object.values(KIND_META).map((k) => k.label);
    expect(labels).not.toContain('SDXL');
    expect(labels).not.toContain('영상 (I2V)');
  });
});
