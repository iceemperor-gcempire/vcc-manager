/**
 * SaaS(비 ComfyUI) 작업판 배포 산출물 가드 (#943).
 *
 * ComfyUI 가드(workboardExports.test.js)는 workflowData·placeholder·저장 노드를 전제하므로
 * OpenAI/Gemini 처럼 워크플로가 없는 작업판에는 적용할 수 없다. 여기서는 파일만 보고
 * 알 수 있는 것만 본다 — 선택지가 비었거나, 필수인데 기본값이 없거나, 서버 정보가 빠진 것.
 */
const fs = require('fs');
const path = require('path');

const EXPORT_DIR = path.join(__dirname, '../../workboards/openai');

const EXPORTS = fs.existsSync(EXPORT_DIR)
  ? fs.readdirSync(EXPORT_DIR).filter((f) => f.endsWith('.json')).map((file) => ({
      file,
      raw: JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, file), 'utf8')),
    }))
  : [];

describe('workboards/openai 배포 산출물 (#943)', () => {
  it('검사 대상이 실제로 존재한다', () => {
    // 0건이면 아래 테스트가 전부 조용히 통과한다 — 디렉토리가 비거나 옮겨진 것을 여기서 잡는다
    expect(EXPORTS.length).toBeGreaterThan(0);
  });

  describe.each(EXPORTS.map((e) => [e.file, e]))('%s', (_file, exported) => {
    const wb = exported.raw.workboard;
    const fields = wb.additionalInputFields || [];

    it('export 메타(appVersion · server)가 있다', () => {
      expect(exported.raw.appVersion).toEqual(expect.objectContaining({ major: expect.any(Number) }));
      expect(exported.raw.server).toEqual(expect.objectContaining({ name: expect.any(String), serverType: expect.any(String) }));
    });

    it('SaaS 작업판은 workflowData 를 쓰지 않는다', () => {
      expect(wb.workflowData || '').toBe('');
    });

    it('select 필드는 선택지가 비어 있지 않고 기본값이 그 안에 있다', () => {
      for (const f of fields.filter((x) => x.type === 'select')) {
        const values = (f.options || []).map((o) => o.value);
        expect(values.length).toBeGreaterThan(0);
        if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
          expect(values).toContain(f.defaultValue);
        }
      }
    });

    it('모델 노출 정책이 whitelist 면 목록이 비어 있지 않다', () => {
      // 빈 whitelist + whitelist 정책 = 아무 모델도 못 고르는 작업판 (#943 의 실제 사고 원인 계열)
      if (wb.modelExposurePolicy === 'whitelist') {
        expect((wb.modelWhitelist || []).length).toBeGreaterThan(0);
      }
    });
  });
});
