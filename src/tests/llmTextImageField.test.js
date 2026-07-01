/**
 * #666 LLM(text) 작업판 기본 이미지 입력 필드
 * text 템플릿 3종에 선택형 image 입력 필드가 포함돼 있는지 (누락 회귀 방지).
 */
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '../../frontend/src/templates');
const TEXT_TEMPLATES = ['Gemini-text.json', 'OpenAI-text.json', 'OpenAI Compatible-text.json'];

describe('#666 text 템플릿 이미지 입력 필드', () => {
  TEXT_TEMPLATES.forEach((file) => {
    test(`${file} 에 선택형 image 입력 필드 존재`, () => {
      const data = JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, file), 'utf8'));
      const fields = data.additionalInputFields || [];
      const imageField = fields.find((f) => f.type === 'image');
      expect(imageField).toBeTruthy();
      expect(imageField.required).toBe(false); // 선택 입력 — 비워도 텍스트만으로 동작
      expect(imageField.imageConfig).toBeTruthy();
      expect(imageField.imageConfig.maxImages).toBeGreaterThanOrEqual(1);
      expect(imageField.imageConfig.maxImages).toBeLessThanOrEqual(3); // Workboard 스키마 max 3
    });
  });
});
