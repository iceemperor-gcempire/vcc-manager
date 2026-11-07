#!/usr/bin/env node
// 작업판 템플릿 생성 스크립트 (#1142).
//
// 새 작업판 만들기 화면의 템플릿 중 배포용 판 파일(workboards/)과 같은 것은 손으로 따로 두지 않고
// 판 파일에서 만든다. 예전 OpenAI 이미지 템플릿은 1.x 시절 필드(크기 3종·품질 high 까지·모델 제한 없음)로
// 멈춰 있었는데, 판 파일만 고치고 템플릿은 잊었기 때문이다. 판 파일을 고쳤으면 이 스크립트를 다시 돌린다.
//
//   node scripts/sync-workboard-templates.js
//
// 동기화 회귀는 src/tests/workboardTemplatesMirror.test.js 가 잡는다 (생성 결과 ↔ 디스크 비교).
// 판 파일은 손 편집본이 아니라 서버에서 다시 내보낸 것이어야 한다 (vcc-workboard-sync 의 저작 함정 참고).

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const TEMPLATE_DIR = path.join(REPO_ROOT, 'frontend/src/templates');

// 같은 (서버 종류, 출력 형식)에 여럿이면 첫 항목이 기본이다.
// target 은 <serverType>-<outputFormat>[-<이름>].json — index.js 가 import 한다
const TEMPLATE_SOURCES = [
  { id: 'gpt-image', label: 'GPT Image (2.5 이하)', source: 'workboards/openai/gpt-image.json', target: 'OpenAI-image.json' },
  { id: 'gpt-image-2.6', label: 'GPT Image 2.6 (정지 이미지 · SVG)', source: 'workboards/openai/gpt-image-2.6.json', target: 'OpenAI-image-gpt-image-2.6.json' },
  { id: 'gpt-image-2.6-gif', label: 'GPT Image 2.6 GIF', source: 'workboards/openai/gpt-image-2.6-gif.json', target: 'OpenAI-image-gpt-image-2.6-gif.json' },
];

// 템플릿에 옮기는 판 설정. 이름·설명은 만드는 사람이 입력하는 칸이라 넣지 않는다 —
// 만들기 화면은 템플릿을 입력값 위에 덮어쓰므로, 넣으면 사람이 쓴 설명이 사라진다.
// 종류·출력 형식은 화면에서 고른 값이고, version 은 서버가 매긴다
const TEMPLATE_KEYS = [
  'additionalInputFields',
  'workflowData',
  'allowedModelTypes',
  'allowedModelFolders',
  'modelExposurePolicy',
  'modelWhitelist',
  'loraExposurePolicy',
  'loraWhitelist',
  'allowedLoraFolders',
  'promptGeneratorInstructions',
];

function renderTemplate(entry) {
  const exported = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, entry.source), 'utf8'));
  const workboard = exported.workboard || {};
  const template = {
    // index.js 가 고르기 목록에 쓰고, 작업판을 만들 때는 떼어 낸다
    _template: {
      id: entry.id,
      label: entry.label,
      source: entry.source,
      generated: '수정 금지 — node scripts/sync-workboard-templates.js 로 다시 만든다',
    },
  };
  for (const key of TEMPLATE_KEYS) {
    if (workboard[key] !== undefined) template[key] = workboard[key];
  }
  return `${JSON.stringify(template, null, 2)}\n`;
}

function main() {
  for (const entry of TEMPLATE_SOURCES) {
    fs.writeFileSync(path.join(TEMPLATE_DIR, entry.target), renderTemplate(entry));
    console.log(`✅ ${entry.target} ← ${entry.source}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TEMPLATE_SOURCES, TEMPLATE_KEYS, TEMPLATE_DIR, renderTemplate };
