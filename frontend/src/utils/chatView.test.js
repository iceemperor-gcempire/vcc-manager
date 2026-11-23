import { describe, it, expect } from 'vitest';
import {
  toChatRows, applyChatEvent, emptyLiveTurn, toolLabel, mergeJobs, isJobActive, jobResults, isSessionBusy,
} from './chatView';
import { parseSseFrame, takeSseFrames } from '../services/streamChat';

describe('toChatRows — 저장된 대화를 화면 줄로', () => {
  it('system 메시지는 숨긴다', () => {
    expect(toChatRows([{ role: 'system', content: '지침' }, { role: 'user', content: '안녕' }]))
      .toEqual([{ kind: 'bubble', role: 'user', content: '안녕', attachments: [] }]);
  });

  it('도구만 부른 빈 assistant 메시지는 말풍선이 아니라 도구 줄이 된다', () => {
    const rows = toChatRows([
      { role: 'user', content: '고양이 그려 줘' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'find_workboards', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c1', name: 'find_workboards', content: '{"workboards":[]}' },
      { role: 'assistant', content: '', toolCalls: [{ id: 'c2', name: 'generate', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c2', name: 'generate', content: '{"jobId":"j1"}' },
      { role: 'assistant', content: '시작했어요.' },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['bubble', 'tools', 'bubble']);
    expect(rows[1].steps.map((s) => [s.label, s.status])).toEqual([['작업판 찾기', 'ok'], ['생성 요청', 'ok']]);
    expect(rows[2].content).toBe('시작했어요.');
  });

  it('도구 결과가 error 를 담으면 실패로, 결과가 아직 없으면 진행 중으로', () => {
    const rows = toChatRows([
      { role: 'assistant', content: '찾아볼게요', toolCalls: [{ id: 'a', name: 'generate' }, { id: 'b', name: 'get_job' }] },
      { role: 'tool', toolCallId: 'a', content: '{"error":"입력 값이 작업판과 맞지 않습니다."}' },
    ]);
    expect(rows[0]).toMatchObject({ kind: 'bubble', content: '찾아볼게요' });
    expect(rows[1].steps).toMatchObject([
      { id: 'a', status: 'failed', error: '입력 값이 작업판과 맞지 않습니다.' },
      { id: 'b', status: 'running' },
    ]);
  });

  it('잘린 도구 결과(JSON 이 깨진 본문)와 짝 없는 결과에도 던지지 않는다', () => {
    const rows = toChatRows([
      { role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 'get_workboard' }] },
      { role: 'tool', toolCallId: 'a', content: '{"name":"판","fields":[{"na' },
      { role: 'tool', toolCallId: 'zzz', content: '{}' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].steps[0].status).toBe('ok');
  });

  it('사용자 메시지는 글이 비어도(첨부만) 보인다. 빈 값·null 입력은 빈 목록', () => {
    expect(toChatRows([{ role: 'user', content: '', attachments: [{ imageId: 'i', url: '/u' }] }])[0].attachments).toHaveLength(1);
    expect(toChatRows(null)).toEqual([]);
    expect(toChatRows([null, undefined])).toEqual([]);
  });

  it('모르는 도구는 이름 그대로 보인다', () => {
    expect(toolLabel('new_tool')).toBe('new_tool');
    expect(toolLabel(undefined)).toBe('도구');
  });
});

describe('applyChatEvent — 스트림 이벤트를 진행 중인 턴에', () => {
  const run = (events) => events.reduce((t, [e, d]) => applyChatEvent(t, e, d), emptyLiveTurn());

  it('글 조각은 이어 붙고, 도구 호출 뒤의 글은 새 말풍선이 된다', () => {
    const turn = run([
      ['token', { delta: '찾아' }], ['token', { delta: '볼게요' }],
      ['tool_call', { id: 'c1', name: 'find_workboards' }],
      ['tool_result', { id: 'c1', name: 'find_workboards', outcome: 'ok' }],
      ['tool_call', { id: 'c2', name: 'generate' }],
      ['tool_result', { id: 'c2', name: 'generate', outcome: 'handler_error' }],
      ['round', { round: 1 }],
      ['token', { delta: '끝' }],
    ]);
    expect(turn.rows.map((r) => r.kind)).toEqual(['bubble', 'tools', 'bubble']);
    expect(turn.rows[0].content).toBe('찾아볼게요');
    expect(turn.rows[1].steps.map((s) => s.status)).toEqual(['ok', 'failed']);
    expect(turn.rows[2].content).toBe('끝');
  });

  it('원본 턴을 바꾸지 않는다', () => {
    const a = applyChatEvent(emptyLiveTurn(), 'token', { delta: 'x' });
    const b = applyChatEvent(a, 'token', { delta: 'y' });
    expect(a.rows[0].content).toBe('x');
    expect(b.rows[0].content).toBe('xy');
  });

  it('job 이벤트는 작업 목록에 한 번만 들어간다', () => {
    const job = { jobId: 'j1', status: 'pending', workboard: { id: 'w', name: '이미지 판', output: 'image' } };
    const turn = run([['job', job], ['job', job]]);
    expect(turn.jobs).toEqual([{ _id: 'j1', status: 'pending', workboardId: { _id: 'w', name: '이미지 판', outputFormat: 'image' } }]);
  });

  it('모르는 이벤트·빈 조각은 턴을 그대로 둔다', () => {
    const t = emptyLiveTurn();
    expect(applyChatEvent(t, 'session', { sessionId: 's' })).toBe(t);
    expect(applyChatEvent(t, 'token', { delta: '' })).toBe(t);
  });
});

describe('작업 패널 보조', () => {
  it('mergeJobs — 서버 목록에 이미 있는 작업은 서버 것을 쓴다', () => {
    const merged = mergeJobs([{ _id: 'j1', status: 'completed' }], [{ _id: 'j1', status: 'pending' }, { _id: 'j2', status: 'pending' }]);
    expect(merged.map((j) => [j._id, j.status])).toEqual([['j1', 'completed'], ['j2', 'pending']]);
    expect(mergeJobs(undefined, undefined)).toEqual([]);
  });

  it('isJobActive — 대기·진행만 참', () => {
    expect(['pending', 'processing', 'completed', 'failed', 'cancelled'].map((status) => isJobActive({ status })))
      .toEqual([true, true, false, false, false]);
    expect(isJobActive(null)).toBe(false);
  });

  it('jobResults — 종류를 붙이고, 채워지지 않은(id 만 있는) 항목은 뺀다', () => {
    const results = jobResults({ resultImages: [{ _id: 'i', url: '/i' }, 'abc'], resultVideos: [{ _id: 'v', url: '/v' }] });
    expect(results.map((r) => r.type)).toEqual(['image', 'video']);
    expect(jobResults(undefined)).toEqual([]);
  });

  it('isSessionBusy', () => {
    expect(isSessionBusy({ status: 'processing' })).toBe(true);
    expect(isSessionBusy({ status: 'completed' })).toBe(false);
    expect(isSessionBusy(undefined)).toBe(false);
  });
});

describe('SSE 프레임 읽기', () => {
  it('이벤트 이름과 JSON 데이터를 읽고, 하트비트 코멘트는 버린다', () => {
    expect(parseSseFrame('event: token\ndata: {"delta":"가"}')).toEqual({ event: 'token', data: { delta: '가' } });
    expect(parseSseFrame(': ping')).toBeNull();
    expect(parseSseFrame('data: 글자')).toEqual({ event: 'message', data: '글자' });
  });

  it('덜 온 꼬리는 남겨 두었다가 다음 조각과 이어 읽는다', () => {
    const first = takeSseFrames(': open\n\nevent: token\ndata: {"delta":"a"}\n\nevent: to');
    expect(first.events).toEqual([{ event: 'token', data: { delta: 'a' } }]);
    expect(first.rest).toBe('event: to');
    const second = takeSseFrames(`${first.rest}ken\ndata: {"delta":"b"}\n\n`);
    expect(second.events).toEqual([{ event: 'token', data: { delta: 'b' } }]);
    expect(second.rest).toBe('');
  });
});
