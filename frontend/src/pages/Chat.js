import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Alert, Button, CircularProgress, Drawer, IconButton, Badge, MenuItem, TextField, Tooltip,
  useMediaQuery, useTheme,
} from '@mui/material';
import { ForumOutlined, MenuOpen, ViewSidebarOutlined, SmartToyOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { chatAPI } from '../services/api';
import { streamChatMessage } from '../services/streamChat';
import { useAuth } from '../contexts/AuthContext';
import { usePersistedState } from '../hooks/usePersistedState';
import { useConfirm } from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import ChatBubble from '../components/common/chat/ChatBubble';
import ChatSessionList from '../components/chat/ChatSessionList';
import ChatToolSteps from '../components/chat/ChatToolSteps';
import ChatComposer, { MAX_CHAT_ATTACHMENTS, addAttachments } from '../components/chat/ChatComposer';
import ChatJobPanel from '../components/chat/ChatJobPanel';
import config from '../config';
import {
  toChatRows, applyChatEvent, emptyLiveTurn, mergeJobs, isJobActive, isSessionBusy,
} from '../utils/chatView';

// 채팅 화면 (#1288, 에픽 #1267) — 왼쪽 대화 목록 · 가운데 대화 · 오른쪽 작업 상황 패널.
//
// 대화 상대는 텍스트(LLM) 작업판이다. 대화로 생성을 시키면 서버가 작업을 등록하고(보통 작업 — 작업 히스토리에도
// 남는다) 그 진행·결과가 작업 패널에 나타난다. 서버는 화면이 떠나도 턴을 끝까지 돌리므로, 돌아왔을 때
// 대화가 아직 '응답 중'이면 끝날 때까지 다시 읽는다.

const DELETE_CONFIRM = {
  title: '이 대화를 삭제하시겠습니까?',
  description: '대화 기록이 지워집니다. 이 대화에서 만든 이미지·영상과 작업 기록은 내 콘텐츠·작업 히스토리에 그대로 남습니다.',
  danger: true,
  confirmLabel: '삭제',
};

/** 화면 아래 끝까지 채우는 높이 — 셸의 헤더·여백 크기를 몰라도 되게 실제 위치를 잰다 */
function useFillHeight(bottomGap) {
  const ref = useRef(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top + window.scrollY;
      setHeight(Math.max(window.innerHeight - top - bottomGap, 360));
    };
    // 다른 화면에서 내려 둔 스크롤이 남아 있으면 채팅 틀이 화면 밖으로 밀린다 — 들어올 때 맨 위로
    window.scrollTo(0, 0);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [bottomGap]);
  return [ref, height];
}

const sessionKey = (id) => ['chatSession', id];
const sessionFetch = (id) => () => chatAPI.getSession(id).then((r) => r.data.data);

export default function Chat() {
  const { id: routeId } = useParams();
  const sessionId = routeId || null;
  // 스트림 콜백이 "지금 보고 있는 대화"를 알 수 있게 — 콜백은 보낸 순간의 값을 붙잡고 있다
  const routeRef = useRef(sessionId);
  routeRef.current = sessionId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { isAdmin } = useAuth();
  const theme = useTheme();
  const listInline = useMediaQuery(theme.breakpoints.up('md'));
  const panelInline = useMediaQuery(theme.breakpoints.up('lg'));
  const [listOpen, setListOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rootRef, height] = useFillHeight(16);

  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [boardChoice, setBoardChoice] = usePersistedState('vcc.chat.workboardId', '');
  // 지금 이 화면이 스트림으로 받고 있는 턴.
  // { sessionId (새 대화는 서버가 알려 줄 때까지 null), base·baseJobs (보낸 순간의 저장본), userRow, turn }
  const [live, setLive] = useState(null);
  const mounted = useRef(true);
  // 개발 모드(StrictMode)는 이펙트를 한 번 걷었다 다시 건다 — 다시 걸 때 true 로 돌려놓아야 한다
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const boardsQuery = useQuery({ queryKey: ['chatWorkboards'], queryFn: () => chatAPI.getWorkboards().then((r) => r.data.data), staleTime: 60 * 1000 });
  const sessionsQuery = useQuery({ queryKey: ['chatSessions'], queryFn: () => chatAPI.getSessions({ limit: 100 }).then((r) => r.data.data), staleTime: 0 });
  const boards = boardsQuery.data?.workboards || [];
  const sessions = sessionsQuery.data?.sessions || [];

  const liveHere = !!live && live.sessionId === sessionId;
  const sessionQuery = useQuery({
    queryKey: sessionKey(sessionId),
    queryFn: sessionFetch(sessionId),
    // 스트림으로 받는 동안은 다시 읽지 않는다 — 저장본과 스트림이 같은 메시지를 두 번 그리게 된다
    enabled: !!sessionId && !liveHere,
    staleTime: 0,
    // 없는 대화(404)는 다시 묻지 않는다. 그 밖의 오류는 잠깐의 장애일 수 있다
    retry: (count, err) => err?.response?.status !== 404 && count < 2,
    // 서버에서 턴이 아직 돌거나(화면을 떠났다 돌아온 경우) 끝나지 않은 작업이 있으면 계속 읽는다
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && (isSessionBusy(d) || (d.jobs || []).some(isJobActive)) ? config.monitoring.recentJobsInterval : false;
    },
  });
  const detail = sessionId ? sessionQuery.data : null;
  const session = detail?.session || null;
  const serverJobs = detail?.jobs || null;

  // 서버에서 돌던 턴이 끝나면 목록의 '응답 중' 표시도 갱신한다
  const busy = isSessionBusy(detail) && !liveHere;
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    wasBusy.current = busy;
  }, [busy, queryClient]);

  const board = useMemo(() => boards.find((b) => b._id === boardChoice) || boards[0] || null, [boards, boardChoice]);
  const partner = session
    ? { name: session.workboardId?.name, model: session.model }
    : (board ? { name: board.name, model: board.model } : null);
  const partnerSeesImages = session
    ? boards.find((b) => b._id === session.workboardId?._id)?.acceptsImages
    : board?.acceptsImages;

  const rows = useMemo(() => {
    // 받는 동안은 보낸 순간의 저장본 위에 그린다 — 그 사이 끝난 조회가 이번 턴의 메시지를 담아 와도 두 번 그리지 않는다
    if (liveHere) return [...live.base, live.userRow, ...live.turn.rows];
    return toChatRows(session?.messages);
  }, [session, liveHere, live]);
  const jobs = useMemo(
    () => (liveHere ? mergeJobs(live.baseJobs, live.turn.jobs) : mergeJobs(serverJobs, [])),
    [serverJobs, liveHere, live],
  );
  const activeJobs = jobs.filter(isJobActive).length;

  // 새 줄이 생기면 맨 아래로
  const threadRef = useRef(null);
  const lastRow = rows[rows.length - 1];
  const scrollMark = `${rows.length}:${lastRow?.kind === 'bubble' ? lastRow.content.length : lastRow?.steps?.length || 0}:${busy}`;
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [scrollMark, sessionId]);

  // 턴이 끝났다(성공이든 실패든) — 서버 저장본을 다시 읽고 나서 스트림 표시를 걷는다 (그 사이 깜빡임 없이)
  const settle = useCallback(async (sid) => {
    try {
      if (sid) {
        // 턴이 끝나기 전에 떠난 조회가 남아 있으면 그 옛 결과를 받게 된다 — 끊고 새로 읽는다
        await queryClient.cancelQueries({ queryKey: sessionKey(sid) });
        await queryClient.fetchQuery({ queryKey: sessionKey(sid), queryFn: sessionFetch(sid), staleTime: 0 });
      }
    } catch (_) { /* 다시 읽기 실패 — 아래에서 스트림 표시를 걷으면 쿼리가 스스로 다시 읽는다 */ }
    queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    if (mounted.current) setLive(null);
  }, [queryClient]);

  const handleSend = () => {
    const body = text.trim();
    if (!body || live) return;
    if (!sessionId && !board) return;
    const sent = { text, attachments };
    const startedIn = sessionId;
    let sid = sessionId;
    let settled = false;
    let opened = false; // 스트림이 열렸는가 — 열리기 전의 실패는 보낸 것이 저장되지 않은 것이다
    const finish = () => { if (!settled) { settled = true; settle(sid); } };

    setLive({
      sessionId,
      base: toChatRows(session?.messages),
      baseJobs: serverJobs || [],
      userRow: { kind: 'bubble', role: 'user', content: body, attachments },
      turn: emptyLiveTurn(),
    });
    setText('');
    setAttachments([]);

    streamChatMessage(
      { ...(sessionId ? { sessionId } : { workboardId: board._id }), text: body, imageIds: attachments.map((a) => a.imageId) },
      {
        onEvent: (event, data) => {
          opened = true;
          if (!mounted.current) return;
          if (event === 'session') {
            sid = data.sessionId;
            setLive((l) => (l ? { ...l, sessionId: sid } : l));
            // 새 대화를 보낸 그 화면에 아직 있을 때만 옮긴다 — 그 사이 다른 대화를 열었으면 끌고 가지 않는다
            if (!startedIn && routeRef.current === null) navigate(`/chat/${sid}`, { replace: true });
            queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
          } else if (event === 'done' || event === 'error') {
            // 턴 안의 오류는 서버가 대화에 남긴다 — 다시 읽으면 대화 아래에 보인다
            finish();
          } else {
            setLive((l) => (l ? { ...l, turn: applyChatEvent(l.turn, event, data) } : l));
          }
        },
        onClose: finish, // done 없이 끊긴 경우에도 저장본으로 돌아간다
        onError: (err) => {
          if (!mounted.current) return;
          if (!opened) {
            // 스트림을 열지 못했다 (검증 실패·이미 응답 중 등) — 보낸 것은 저장되지 않았으니 입력을 되돌린다
            toast.error(err.message || '메시지를 보내지 못했습니다.');
            if (routeRef.current === startedIn) {
              setText(sent.text);
              setAttachments(sent.attachments);
            }
            settled = true;
            setLive(null);
            if (sid) queryClient.invalidateQueries({ queryKey: sessionKey(sid) });
          } else {
            // 받는 도중 연결이 끊겼다 — 서버는 턴을 계속 돌린다. 저장본을 읽어 '응답 중'으로 이어 본다
            toast.error('연결이 끊겼습니다. 응답은 서버에서 계속 만들어집니다.');
            finish();
          }
        },
      },
    );
  };

  const handleNew = () => { setListOpen(false); navigate('/chat'); };
  const handleSelect = (s) => { setListOpen(false); navigate(`/chat/${s._id}`); };
  const handleRename = async (s, title) => {
    try {
      await chatAPI.renameSession(s._id, title);
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    } catch (err) {
      toast.error(err.response?.data?.message || '제목을 바꾸지 못했습니다.');
    }
  };
  const handleDelete = async (s) => {
    if (!(await confirm(DELETE_CONFIRM))) return;
    try {
      await chatAPI.deleteSession(s._id);
      queryClient.removeQueries({ queryKey: sessionKey(s._id) });
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
      queryClient.invalidateQueries({ queryKey: ['historyConvs'] });
      if (s._id === sessionId) navigate('/chat', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || '대화를 지우지 못했습니다.');
    }
  };
  const handleAttachResult = (image) => {
    setAttachments((cur) => addAttachments(cur, [image]));
    setPanelOpen(false);
  };

  const sessionList = (
    <ChatSessionList
      sessions={sessions}
      activeId={sessionId}
      loading={sessionsQuery.isLoading}
      onSelect={handleSelect}
      onNew={handleNew}
      onRename={handleRename}
      onDelete={handleDelete}
    />
  );
  const jobPanel = (
    <ChatJobPanel partner={partner} jobs={jobs} onAttach={handleAttachResult} canAttach={attachments.length < MAX_CHAT_ATTACHMENTS} />
  );

  const noBoards = !boardsQuery.isLoading && !boardsQuery.isError && boards.length === 0;
  const notFound = !!sessionId && sessionQuery.error?.response?.status === 404;
  // 대화를 한 번도 못 읽은 채 난 오류 (서버 장애·연결 끊김) — 없는 대화로 보이지 않게 따로 알린다
  const loadFailed = !!sessionId && !liveHere && sessionQuery.isError && !notFound && !detail;
  const loadingSession = !!sessionId && !liveHere && sessionQuery.isLoading;
  const waiting = liveHere && !(lastRow?.kind === 'bubble' && lastRow.role === 'assistant');
  const composerDisabled = !!live || busy || notFound || loadFailed || loadingSession || (!sessionId && !board);
  const title = session?.title || (sessionId ? '' : '새 대화');

  let center;
  if (notFound) {
    center = (
      <EmptyState
        icon={<ForumOutlined />}
        title="대화를 찾을 수 없습니다"
        description="지워졌거나 다른 계정의 대화입니다."
        action={<Button variant="outlined" onClick={handleNew}>새 대화</Button>}
      />
    );
  } else if (loadFailed) {
    center = (
      <Alert severity="error" sx={{ m: 'auto' }} action={<Button color="inherit" size="small" onClick={() => sessionQuery.refetch()}>다시 시도</Button>}>
        대화를 불러오지 못했습니다.
      </Alert>
    );
  } else if (!sessionId && noBoards) {
    const hasText = (boardsQuery.data?.textWorkboards || 0) > 0;
    center = (
      <EmptyState
        icon={<SmartToyOutlined />}
        title="대화 상대로 쓸 작업판이 없습니다"
        description={[
          hasText
            ? '텍스트 작업판은 있지만 채팅에 쓸 수 있는 것이 없습니다. 채팅은 OpenAI · OpenAI Compatible 서버의 텍스트 작업판 가운데 기본 모델이 정해진 판과 할 수 있습니다.'
            : '채팅은 텍스트(LLM) 작업판과 합니다. OpenAI · OpenAI Compatible 서버에 텍스트 작업판을 만들고 기본 모델을 정해 주세요.',
          isAdmin ? '' : '작업판은 관리자가 만듭니다 — 관리자에게 요청하세요.',
        ].filter(Boolean).join(' ')}
        action={isAdmin ? <Button variant="contained" onClick={() => navigate('/admin/workboards/new')}>작업판 만들기</Button> : null}
      />
    );
  } else if (loadingSession || (!sessionId && boardsQuery.isLoading)) {
    center = <Box sx={{ display: 'grid', placeItems: 'center', flex: 1 }}><CircularProgress size={24} /></Box>;
  } else if (rows.length === 0) {
    center = (
      <Box sx={{ m: 'auto', textAlign: 'center', maxWidth: 420, px: 4 }}>
        <ForumOutlined sx={{ fontSize: 36, color: 'text.tertiary', mb: 2 }} />
        <Typography sx={{ fontWeight: 700, mb: 1 }}>무엇을 만들까요?</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          “고양이 그림 그려 줘”처럼 말하면 알맞은 작업판을 골라 만듭니다. 이미지를 붙이고 “영상으로 만들어 줘”라고 해도 됩니다.
          만든 것은 작업 히스토리와 내 콘텐츠에 그대로 남습니다.
        </Typography>
      </Box>
    );
  } else {
    center = (
      <>
        {rows.map((row, i) => (row.kind === 'tools'
          ? <ChatToolSteps key={i} steps={row.steps} />
          : (
            <ChatBubble
              key={i}
              role={row.role}
              content={row.content}
              attachments={row.attachments}
              markdown={row.role === 'assistant'}
              streaming={liveHere && i === rows.length - 1 && row.role === 'assistant'}
              streamingText={row.content}
            />
          )))}
        {(waiting || busy) && <ChatBubble role="assistant" streaming streamingText="" />}
        {!liveHere && session?.status === 'failed' && session.error?.message && (
          <Alert severity="error" sx={{ alignSelf: 'stretch' }}>
            응답을 받지 못했습니다 — {session.error.message}
          </Alert>
        )}
      </>
    );
  }

  return (
    <Box
      ref={rootRef}
      sx={{
        display: 'flex', minWidth: 0, height: height ? `${height}px` : '70vh',
        mb: { sm: -8 }, // 셸의 아래 여백(48px)을 다른 변과 같은 16px 로 — 채팅은 화면을 끝까지 쓴다
        border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden', bgcolor: 'background.default',
      }}
    >
      {listInline ? (
        <Box sx={{ width: 248, flex: '0 0 auto', borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', minHeight: 0 }}>
          {sessionList}
        </Box>
      ) : (
        <Drawer open={listOpen} onClose={() => setListOpen(false)} PaperProps={{ sx: { width: 280 } }}>{sessionList}</Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', minHeight: 52 }}>
          {!listInline && (
            <Tooltip title="대화 목록">
              <IconButton aria-label="대화 목록" onClick={() => setListOpen(true)}><MenuOpen /></IconButton>
            </Tooltip>
          )}
          <Typography noWrap component="h1" sx={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 0 }}>{title}</Typography>
          {!sessionId && boards.length > 0 && (
            <TextField
              select size="small" label="대화 상대" value={board?._id || ''}
              onChange={(e) => setBoardChoice(e.target.value)}
              disabled={!!live}
              sx={{ minWidth: 140, maxWidth: { xs: 170, sm: 260 } }}
            >
              {boards.map((b) => (
                <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>
              ))}
            </TextField>
          )}
          {!panelInline && (
            <Tooltip title="작업 상황">
              <IconButton aria-label="작업 상황" onClick={() => setPanelOpen(true)}>
                <Badge color="primary" badgeContent={activeJobs}>
                  <ViewSidebarOutlined />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box ref={threadRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3, p: { xs: 3, sm: 5 } }}>
          {center}
        </Box>

        <ChatComposer
          text={text}
          onTextChange={setText}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          onSend={handleSend}
          disabled={composerDisabled}
          placeholder={busy || live ? '응답을 받는 중입니다…' : (listInline ? '메시지를 입력하세요 (Enter 로 보내기, Shift+Enter 로 줄바꿈)' : '메시지를 입력하세요')}
          visionNote={partnerSeesImages === false ? '대화 상대는 이미지를 직접 보지 못합니다 — 붙인 이미지는 생성 작업의 입력으로 쓰입니다.' : ''}
        />
      </Box>

      {panelInline ? (
        <Box sx={{ width: 320, flex: '0 0 auto', borderLeft: 1, borderColor: 'divider', bgcolor: 'background.default', minHeight: 0 }}>
          {jobPanel}
        </Box>
      ) : (
        <Drawer anchor="right" open={panelOpen} onClose={() => setPanelOpen(false)} PaperProps={{ sx: { width: 320, maxWidth: '88vw' } }}>
          {jobPanel}
        </Drawer>
      )}
    </Box>
  );
}
