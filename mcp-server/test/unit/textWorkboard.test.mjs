/**
 * MCP 텍스트 작업판 실행 (#1015) — SSE 결과 해석, 입력 만들기.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSseEvents, resultFromSse } from '../../src/utils/apiClient.js';
import { buildTextInputData } from '../../src/utils/textInput.js';

const SSE = [
  ': open', '',
  'event: token', 'data: {"delta":"빨간"}', '',
  ': ping', '',
  'event: token', 'data: {"delta":" 원"}', '',
  'event: done', 'data: {"conversationId":"c1","result":"빨간 원","model":"m1","usage":{"totalTokens":10}}', '',
].join('\n');

test('SSE — 주석(:open, :ping)은 버리고 이벤트만 읽는다', () => {
  const events = parseSseEvents(SSE);
  assert.deepEqual(events.map((e) => e.event), ['token', 'token', 'done']);
  assert.equal(events[0].data.delta, '빨간');
});

test('SSE — done 의 데이터를 결과로 돌려준다', () => {
  assert.deepEqual(resultFromSse(SSE), { conversationId: 'c1', result: '빨간 원', model: 'm1', usage: { totalTokens: 10 } });
});

test('SSE — error 이벤트면 그 메시지로 실패한다', () => {
  const text = ': open\n\nevent: error\ndata: {"message":"모델이 이미지를 지원하지 않음"}\n\n';
  assert.throws(() => resultFromSse(text), /모델이 이미지를 지원하지 않음/);
});

test('SSE — done 없이 끝나면 받은 이벤트 수와 함께 실패한다', () => {
  assert.throws(() => resultFromSse(': open\n\nevent: token\ndata: {"delta":"a"}\n\n'), /받은 이벤트 1개/);
});

test('SSE — CRLF 줄바꿈도 읽는다', () => {
  assert.equal(resultFromSse('event: done\r\ndata: {"result":"ok"}\r\n\r\n').result, 'ok');
});

const WB = {
  additionalInputFields: [
    { name: 'base_model', label: '베이스 모델', type: 'baseModel', required: true, defaultValue: 'qwen-default' },
    { name: 'system_prompt', label: '시스템 프롬프트', type: 'string' },
    { name: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
    { name: 'tone', label: '말투', type: 'select', options: [{ key: '정중', value: 'polite' }] },
    { name: 'input_images', label: '이미지', type: 'image', imageConfig: { maxImages: 3 } },
  ],
};

test('입력 — 작업판 기본값을 채운다 (모델을 다시 적지 않아도 된다)', () => {
  const d = buildTextInputData(WB, { prompt: '안녕' });
  assert.equal(d.userPrompt, '안녕');
  assert.equal(d.base_model, 'qwen-default');
  assert.equal(d.temperature, 0.7);
  assert.equal(d.input_images, undefined);
});

test('입력 — model 과 additionalParams 가 기본값보다 앞선다, select 는 이름으로 고른다', () => {
  const d = buildTextInputData(WB, { prompt: 'x', model: 'other', additionalParams: { temperature: 0.2, tone: '정중', system_prompt: '너는 시인' } });
  assert.equal(d.base_model, 'other');
  assert.equal(d.temperature, 0.2);
  assert.deepEqual(d.tone, { key: '정중', value: 'polite' });
  assert.equal(d.system_prompt, '너는 시인');
});

test('입력 — 이미지는 imageId 문자열 배열로 이미지 칸에 넣는다', () => {
  const d = buildTextInputData(WB, { prompt: 'x', imageIds: ['a1', 'b2'] });
  assert.deepEqual(d.input_images, ['a1', 'b2']);
});

test('입력 — 이미지 장수 제한과 이미지 칸 없는 작업판을 알린다', () => {
  assert.throws(() => buildTextInputData(WB, { prompt: 'x', imageIds: ['1', '2', '3', '4'] }), /최대 3장/);
  const noImage = { additionalInputFields: WB.additionalInputFields.filter((f) => f.type !== 'image') };
  assert.throws(() => buildTextInputData(noImage, { prompt: 'x', imageIds: ['1'] }), /이미지를 받지 않습니다/);
});

test('입력 — 기본값 없는 필수 칸이 비면 이름을 알려 준다', () => {
  const wb = { additionalInputFields: [{ name: 'base_model', label: '베이스 모델', type: 'baseModel', required: true }] };
  assert.throws(() => buildTextInputData(wb, { prompt: 'x' }), /base_model \("베이스 모델"\)/);
});
