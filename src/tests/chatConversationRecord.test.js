/**
 * 대화 기록의 채팅용 확장 (#1282).
 *
 * 채팅 화면(#1267)의 대화는 기존 ConversationJob 에 담긴다. 도구 메시지가 섞이므로
 * - 새 필드가 스키마에 남는지 (strict 가 조용히 떨구지 않는지), 옛 문서가 그대로 유효한지
 * - 기존 독자(목록, AI 프롬프트 생성 이어가기, 텍스트 저장)가 그 형태를 만나도 깨지지 않는지
 * 를 고정한다. DB 없이 돈다.
 */
const mongoose = require('mongoose');
const ConversationJob = require('../models/ConversationJob');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { isChatConversation, toConversationListItem, LIST_TOOL_CONTENT_CHARS } = require('../utils/conversationView');

const oid = () => new mongoose.Types.ObjectId();

describe('ConversationJob 스키마', () => {
  const chatDoc = () => new ConversationJob({
    userId: oid(),
    workboardId: oid(),
    kind: 'chat',
    title: '  고양이 그림  ',
    messages: [
      { role: 'user', content: '고양이 그려 줘' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'find_workboards', arguments: '{"outputFormat":"image"}' }] },
      { role: 'tool', toolCallId: 'call_1', name: 'find_workboards', content: '[{"id":"w1"}]' },
      { role: 'assistant', content: '만들었습니다.' },
    ],
  });

  test('도구 호출·결과 필드가 저장 형태에 남는다', () => {
    const doc = chatDoc();
    expect(doc.validateSync()).toBeUndefined();
    const plain = doc.toObject();
    expect(plain.kind).toBe('chat');
    expect(plain.title).toBe('고양이 그림');
    expect(plain.messages[1].toolCalls).toEqual([{ id: 'call_1', name: 'find_workboards', arguments: '{"outputFormat":"image"}' }]);
    expect(plain.messages[2]).toMatchObject({ role: 'tool', toolCallId: 'call_1', name: 'find_workboards', content: '[{"id":"w1"}]' });
  });

  test('도구 호출이 없는 메시지에는 빈 toolCalls 배열이 생기지 않는다', () => {
    const plain = chatDoc().toObject();
    expect(plain.messages[0]).not.toHaveProperty('toolCalls');
    expect(plain.messages[3]).not.toHaveProperty('toolCalls');
  });

  test('kind 를 안 주면 prompt — 기존 호출이 만드는 문서는 그대로', () => {
    const doc = new ConversationJob({ userId: oid(), workboardId: oid(), messages: [{ role: 'user', content: 'hi' }] });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.kind).toBe('prompt');
    expect(isChatConversation(doc)).toBe(false);
  });

  test('모르는 kind·role 은 거절', () => {
    const badKind = new ConversationJob({ userId: oid(), workboardId: oid(), kind: 'other' });
    expect(badKind.validateSync().errors.kind).toBeDefined();
    const badRole = new ConversationJob({ userId: oid(), workboardId: oid(), messages: [{ role: 'function', content: 'x' }] });
    expect(badRole.validateSync().errors['messages.0.role']).toBeDefined();
  });

  test('도구 호출에는 id 와 name 이 있어야 한다', () => {
    const doc = new ConversationJob({
      userId: oid(), workboardId: oid(), kind: 'chat',
      messages: [{ role: 'assistant', toolCalls: [{ arguments: '{}' }] }],
    });
    const errors = Object.keys(doc.validateSync().errors);
    expect(errors).toEqual(expect.arrayContaining(['messages.0.toolCalls.0.id', 'messages.0.toolCalls.0.name']));
  });
});

describe('ImageGenerationJob.conversationId', () => {
  test('대화 연결이 저장 형태에 남고, 없어도 된다', () => {
    const conversationId = oid();
    const linked = new ImageGenerationJob({ userId: oid(), workboardId: oid(), conversationId });
    expect(String(linked.toObject().conversationId)).toBe(String(conversationId));
    const plain = new ImageGenerationJob({ userId: oid(), workboardId: oid() });
    expect(plain.toObject().conversationId).toBeUndefined();
  });
});

describe('conversationView', () => {
  test('isChatConversation — kind 가 없는 옛 lean 문서는 채팅이 아니다', () => {
    expect(isChatConversation({ kind: 'chat' })).toBe(true);
    expect(isChatConversation({ kind: 'prompt' })).toBe(false);
    expect(isChatConversation({})).toBe(false);
    expect(isChatConversation(null)).toBe(false);
  });

  test('목록용: 긴 도구 결과만 줄이고 메시지 수·순서는 그대로', () => {
    const long = 'x'.repeat(LIST_TOOL_CONTENT_CHARS + 500);
    const conv = {
      _id: 'c1', kind: 'chat',
      messages: [
        { role: 'user', content: long },
        { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 't', arguments: '{}' }] },
        { role: 'tool', toolCallId: 'a', name: 't', content: long },
        { role: 'tool', toolCallId: 'b', name: 't', content: 'short' },
        { role: 'assistant', content: long },
      ],
    };
    const out = toConversationListItem(conv);
    expect(out.messages).toHaveLength(5);
    expect(out.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'tool', 'assistant']);
    expect(out.messages[0].content).toBe(long);          // 사용자 글은 그대로
    expect(out.messages[4].content).toBe(long);          // 답도 그대로
    expect(out.messages[2].content).toHaveLength(LIST_TOOL_CONTENT_CHARS + 1);
    expect(out.messages[2].contentTruncated).toBe(true);
    expect(out.messages[3]).toEqual(conv.messages[3]);   // 짧은 도구 결과는 그대로
    expect(conv.messages[2].content).toBe(long);         // 원본은 건드리지 않는다
  });

  test('목록용: 줄일 것이 없으면 같은 객체, 메시지가 없어도 안전', () => {
    const conv = { _id: 'c1', messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }] };
    expect(toConversationListItem(conv)).toBe(conv);
    expect(toConversationListItem({ _id: 'c2' })).toEqual({ _id: 'c2' });
    expect(toConversationListItem(null)).toBeNull();
  });
});
