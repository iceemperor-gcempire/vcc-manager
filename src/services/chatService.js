// 채팅 화면의 대화 한 턴 (#1284, 에픽 #1267).
//
// 사용자 메시지 하나를 받아 LLM 과 도구를 오가고(services/llmToolLoop), 생긴 메시지를 대화 기록
// (ConversationJob, kind: 'chat')에 저장한다. 생성 작업은 도구(services/chatTools)가 등록하고 이 턴은
// 완료를 기다리지 않는다.
//
// 저장 단위: 도구 라운드(assistant 의 호출 + 그 결과 전부)를 한 묶음으로, 마지막 답을 따로. 중간에 모델
// 호출이 실패해도 기록에는 짝이 맞는 메시지만 남는다 — 짝이 깨진 기록은 다음 턴을 LLM 서버가 거절한다.

const openAIChatService = require('./openAIChatService');
const { runToolLoop } = require('./llmToolLoop');
const { createChatTools } = require('./chatTools');
const { loadVisionImages } = require('../utils/visionImages');
const { decryptSecret } = require('../utils/secretCrypto');
const { computeOpenAITextCost } = require('../utils/pricing');
const { getFieldByRole } = require('../utils/customFieldHelpers');
const { FIELD_ROLES, WELL_KNOWN_FIELD_NAME_TO_ROLE } = require('../constants/fieldRoles');

/**
 * 채팅 상대가 될 수 있는 서버 종류. 도구 호출은 Chat Completions 의 tools 로 구현돼 있다 (#769).
 * Gemini 는 응답 형식이 달라 보류. OpenAI 공식 서버의 일부 모델은 Responses API 가 있어야 도구를 쓴다 (#769 댓글).
 */
const CHAT_SERVER_TYPES = Object.freeze(['OpenAI', 'OpenAI Compatible']);
/** 한 턴의 도구 라운드 상한 — 찾기·보기·생성·마무리에 넉넉한 수 */
const CHAT_MAX_ROUNDS = 6;
/**
 * 도구 결과 한 건의 글자 상한. 결과는 대화가 이어지는 내내 문맥에 남는다. 칸이 많은 영상 판의 get_workboard 가
 * 8천 자를 넘어 잘린 적이 있다 (실호출) — 잘리면 뒤쪽 칸을 모델이 못 본다.
 */
const CHAT_MAX_RESULT_CHARS = 16000;
/** 이보다 오래 processing 인 대화는 죽은 턴으로 본다 (서버 재시작 등) — 새 턴을 받는다 */
const STALE_TURN_MS = 10 * 60 * 1000;
const TITLE_CHARS = 40;

const CHAT_SYSTEM_PROMPT = [
  'You are the assistant inside VCC Manager, a tool that generates images and videos through preconfigured "workboards".',
  'Talk with the user normally. When they ask you to make or edit an image, video or audio, do it with the tools:',
  '1. find_workboards for the output they want. If they attached an image that must be used, pass needsImageInput=true.',
  '2. Pick the first workboard that fits (the list is ordered by usage). Call get_workboard when you need its fields — always when an attachment must go into a field.',
  '3. Call generate with a well-written prompt. Leave fields you were not asked about at their defaults.',
  'generate returns immediately with a job id; the job runs in the background and the user sees progress and results in a side panel. Do not wait for it or poll it. Tell the user briefly what you started and with which workboard.',
  'Attached images appear in the user message as "[attached image ids: ...]". Use those ids as attachment field values. Never invent ids.',
  'If a tool returns an error, fix the arguments and try again, or explain the problem to the user. If no workboard fits, say so — do not pretend something was generated.',
  'Reply in the language the user writes in.',
].join('\n');

const extractOpt = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);

const isChatCapableServer = (server) => !!server && server.isActive !== false && CHAT_SERVER_TYPES.includes(server.serverType);

/** 대화 상대로 쓸 수 있는 텍스트 판인가 — 판·서버가 살아 있고 서버가 도구 호출을 받는 종류 */
const isChatCapableWorkboard = (workboard) => !!workboard && workboard.isActive !== false
  && workboard.outputFormat === 'text' && isChatCapableServer(workboard.serverId);

/**
 * 판의 칸 기본값을 역할로 읽는다. 채팅에는 판의 입력 화면이 없어 사용자가 고른 값이 없다 — 기본값이 곧 값이다.
 * 칸은 실행 경로와 같은 규칙으로 찾는다: 특수 type(baseModel 등), 없으면 well-known 이름(system_prompt 등).
 */
function fieldDefaultByRole(workboard, role) {
  const field = getFieldByRole(workboard, role)
    || (workboard.additionalInputFields || []).find((f) => f && WELL_KNOWN_FIELD_NAME_TO_ROLE[f.name] === role);
  return field ? extractOpt(field.defaultValue) : undefined;
}

/** 새 대화의 시스템 메시지 — 채팅 안내 뒤에 판의 시스템 프롬프트 기본값을 붙인다 */
function buildSystemPrompt(workboard) {
  const boardPrompt = fieldDefaultByRole(workboard, FIELD_ROLES.SYSTEM_PROMPT);
  return boardPrompt && String(boardPrompt).trim()
    ? `${CHAT_SYSTEM_PROMPT}\n\n[Workboard instructions]\n${String(boardPrompt).trim()}`
    : CHAT_SYSTEM_PROMPT;
}

/** 판의 기본 모델 */
const defaultModelOf = (workboard) => fieldDefaultByRole(workboard, FIELD_ROLES.MODEL) || '';

const titleFrom = (text) => {
  const line = String(text || '').trim().split('\n')[0];
  return line.length > TITLE_CHARS ? `${line.slice(0, TITLE_CHARS)}…` : line;
};

/** 판이 이미지 칸을 가지면 비전 입력을 보낸다 — 텍스트 판의 기존 규칙과 같다 (#519) */
const sendsVision = (workboard) => (workboard.additionalInputFields || []).some((f) => f && f.type === 'image');

/** 지난 턴의 도구 결과를 줄여 보낼 도구 — 결과가 크고(판 목록·칸 설명), 그 턴이 끝나면 다시 볼 일이 없다 */
const COMPACTED_TOOLS = new Set(['find_workboards', 'get_workboard']);
const COMPACTED_RESULT = '{"note":"earlier result omitted to save context — call the tool again if you need it"}';

/**
 * 저장된 대화를 LLM 호출용 내부 형식으로.
 * - 첨부가 있는 사용자 메시지에는 id 안내를 붙인다 — 모델이 그 id 를 생성 도구의 첨부 칸 값으로 쓴다.
 *   안내는 저장하지 않고 매번 첨부에서 만든다.
 * - 지난 턴(마지막 사용자 메시지 이전)의 판 찾기·판 보기 결과는 짧은 안내로 바꿔 보낸다. 생성 요청 한 번에
 *   1만 토큰 가까이 쌓여 (실호출), 그대로 두면 대화가 길어질수록 문맥이 차서 턴이 실패한다. 메시지 자체는
 *   남기므로 호출과 결과의 짝은 그대로이고, 저장된 기록도 바꾸지 않는다.
 */
async function toModelMessages(conversation, { vision }) {
  let lastUserIndex = -1;
  conversation.messages.forEach((m, i) => { if (m.role === 'user') lastUserIndex = i; });
  return Promise.all(conversation.messages.map(async (m, i) => {
    const out = { role: m.role, content: m.content || '' };
    if (m.role === 'assistant' && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
      out.toolCalls = m.toolCalls.map((c) => ({ id: c.id, name: c.name, arguments: c.arguments }));
    }
    if (m.role === 'tool') {
      out.toolCallId = m.toolCallId;
      out.name = m.name;
      if (i < lastUserIndex && COMPACTED_TOOLS.has(m.name) && out.content.length > COMPACTED_RESULT.length) out.content = COMPACTED_RESULT;
    }
    const ids = (m.attachments || []).map((a) => a.imageId).filter(Boolean);
    if (m.role === 'user' && ids.length > 0) {
      out.content = `${out.content}\n\n[attached image ids: ${ids.map(String).join(', ')}]`;
      // 비전 입력은 이번 턴의 첨부만 — 지난 턴의 이미지를 매번 다시 싣지 않는다 (id 안내는 남는다)
      if (vision && i === lastUserIndex) {
        const images = await loadVisionImages(ids, conversation.userId);
        if (images.length > 0) out.images = images.map((v) => ({ base64: v.base64, mimeType: v.mimeType }));
      }
    }
    return out;
  }));
}

/** 다른 턴이 돌고 있는가 — 오래된 processing 은 죽은 턴으로 보고 받는다 */
function isTurnInProgress(conversation, now = Date.now()) {
  if (conversation.status !== 'processing') return false;
  const touched = new Date(conversation.updatedAt || conversation.createdAt || 0).getTime();
  return now - touched < STALE_TURN_MS;
}

const stamp = (messages) => messages.map((m) => ({ ...m, createdAt: new Date() }));

/**
 * 한 턴을 돌린다. 사용자 메시지는 호출 전에 대화에 저장돼 있어야 한다 (status: 'processing').
 * throw 하지 않는다 — 실패는 대화에 기록하고 결과로 돌려준다.
 *
 * @param {Object} args
 * @param {Object} args.user
 * @param {Object} args.conversation ConversationJob 문서 (kind: 'chat')
 * @param {Object} args.workboard 대화 상대 텍스트 판 (serverId populate)
 * @param {Function} [args.emit] (event, data) => void — 화면으로 보내는 진행 이벤트
 * @returns {Promise<{ ok: boolean, content?: string, error?: string, usage: Object, jobIds: string[], rounds: number, limitReached: boolean }>}
 */
async function runChatTurn({ user, conversation, workboard, emit = () => {}, log = console.log }) {
  const server = workboard.serverId;
  const model = conversation.model || defaultModelOf(workboard);
  const { tools, handlers, state } = createChatTools({
    user,
    conversation,
    onJob: (job, wb) => emit('job', { jobId: String(job._id), status: job.status, workboard: { id: String(wb._id), name: wb.name, output: wb.outputFormat } }),
    log,
  });

  let savedRounds = 0;
  const fail = async (message) => {
    conversation.status = 'failed';
    conversation.error = { message };
    conversation.completedAt = new Date();
    await conversation.save();
    log(`[chat] turn failed conversation=${conversation._id} savedRounds=${savedRounds} jobs=${state.jobIds.length} error=${message}`);
    emit('error', { message, jobIds: state.jobIds });
    return { ok: false, error: message, usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, jobIds: state.jobIds, rounds: savedRounds, limitReached: false };
  };

  let result;
  try {
    const messages = await toModelMessages(conversation, { vision: sendsVision(workboard) });
    const apiKey = decryptSecret(server.configuration?.apiKey);
    result = await runToolLoop({
      messages,
      tools,
      handlers,
      maxRounds: CHAT_MAX_ROUNDS,
      maxResultChars: CHAT_MAX_RESULT_CHARS,
      log,
      callModel: (msgs, offered) => openAIChatService.completeStream(
        server.serverUrl,
        apiKey,
        msgs,
        { model, tools: offered, timeout: server.configuration?.timeout || 60000, extraParams: workboard.llmExtraParams },
        (delta) => emit('token', { delta }),
      ),
      onToolCall: (call) => emit('tool_call', { id: call.id, name: call.name, arguments: call.arguments }),
      onToolResult: (call, r) => emit('tool_result', { id: call.id, name: call.name, outcome: r.outcome }),
      onRound: async (roundMessages) => {
        conversation.messages.push(...stamp(roundMessages));
        await conversation.save();
        savedRounds += 1;
        // 화면은 여기서 흘러온 글(도구 호출 전의 말)을 한 덩어리로 닫는다
        emit('round', { round: savedRounds });
      },
    });
  } catch (e) {
    return fail(e.message || 'LLM 호출에 실패했습니다.');
  }

  if (!result.content || !String(result.content).trim()) {
    return fail('LLM 서버에서 빈 응답을 반환했습니다.');
  }

  conversation.messages.push(...stamp([{ role: 'assistant', content: result.content }]));
  const prev = conversation.usage || {};
  conversation.usage = {
    promptTokens: (prev.promptTokens || 0) + (result.usage.promptTokens || 0),
    completionTokens: (prev.completionTokens || 0) + (result.usage.completionTokens || 0),
    totalTokens: (prev.totalTokens || 0) + (result.usage.totalTokens || 0),
  };
  const cost = computeOpenAITextCost(model, result.usage);
  if (cost) {
    conversation.costEstimate = {
      amount: +((conversation.costEstimate?.amount || 0) + cost.amount).toFixed(6),
      currency: cost.currency,
      pricingVersion: cost.pricingVersion,
    };
  }
  conversation.status = 'completed';
  conversation.error = undefined;
  conversation.completedAt = new Date();
  await conversation.save();
  if (typeof workboard.incrementUsage === 'function') await workboard.incrementUsage();

  log(`[chat] turn done conversation=${conversation._id} rounds=${result.rounds} toolCalls=${result.toolCalls} jobs=${state.jobIds.length} limitReached=${result.limitReached}`);
  emit('done', { conversationId: String(conversation._id), content: result.content, usage: result.usage, jobIds: state.jobIds, limitReached: result.limitReached });
  return { ok: true, content: result.content, usage: result.usage, jobIds: state.jobIds, rounds: result.rounds, limitReached: result.limitReached };
}

module.exports = {
  runChatTurn,
  toModelMessages,
  buildSystemPrompt,
  defaultModelOf,
  titleFrom,
  isChatCapableServer,
  isChatCapableWorkboard,
  isTurnInProgress,
  CHAT_SERVER_TYPES,
  CHAT_SYSTEM_PROMPT,
  CHAT_MAX_ROUNDS,
  STALE_TURN_MS,
};
