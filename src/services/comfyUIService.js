const axios = require('axios');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const getMediaTypeFromFilename = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const animatedExts = ['gif', 'webp', 'apng'];
  const audioExts = ['flac', 'wav', 'mp3', 'ogg', 'opus', 'm4a', 'aac'];   // #805

  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  if (animatedExts.includes(ext)) return 'animated';
  if (imageExts.includes(ext)) return 'image';
  return 'unknown';
};

const getMimeType = (filename) => {
  const ext = filename.toLowerCase().split('.').pop();
  const mimeTypes = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'apng': 'image/apng',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    // 오디오 (#805) — ComfyUI SaveAudio 는 기본 flac, SaveAudioMP3/Opus 도 있다
    'flac': 'audio/flac',
    'wav': 'audio/wav',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

// 히스토리에서 노드 실행 순서 추출
const getNodeExecutionOrder = (history) => {
  // status.messages에서 실행 완료 순서 추출
  if (history.status && history.status.messages) {
    const executionOrder = [];
    for (const message of history.status.messages) {
      // message 형식: ["execution_cached", { nodes: [...] }] 또는 ["executing", { node: "id" }]
      if (Array.isArray(message) && message[0] === 'execution_cached' && message[1]?.nodes) {
        for (const nodeId of message[1].nodes) {
          if (!executionOrder.includes(String(nodeId))) {
            executionOrder.push(String(nodeId));
          }
        }
      } else if (Array.isArray(message) && message[0] === 'executing' && message[1]?.node) {
        const nodeId = String(message[1].node);
        if (!executionOrder.includes(nodeId)) {
          executionOrder.push(nodeId);
        }
      }
    }
    if (executionOrder.length > 0) {
      return executionOrder;
    }
  }
  // fallback: Object.keys 순서 (숫자 키 오름차순)
  return null;
};

// 히스토리 결과 처리 함수
const processHistoryResult = async (serverUrl, history) => {
  const images = [];
  const videos = [];
  const audios = [];   // #805
  console.log(`🔍 Processing history outputs...`);

  if (history.outputs) {
    // 실행 순서 기반으로 출력 노드 순서 결정
    const executionOrder = getNodeExecutionOrder(history);
    const outputNodeIds = Object.keys(history.outputs);

    let orderedNodeIds;
    if (executionOrder) {
      // 실행 순서에서 출력이 있는 노드만 필터링 (실행 순서 유지)
      orderedNodeIds = executionOrder.filter(id => outputNodeIds.includes(id));
      // 실행 순서에 없는 출력 노드가 있으면 뒤에 추가
      for (const id of outputNodeIds) {
        if (!orderedNodeIds.includes(id)) {
          orderedNodeIds.push(id);
        }
      }
      console.log(`📋 Found ${outputNodeIds.length} output nodes (execution order preserved)`);
    } else {
      orderedNodeIds = outputNodeIds;
      console.log(`📋 Found ${outputNodeIds.length} output nodes (default key order)`);
    }

    for (const nodeId of orderedNodeIds) {
      const nodeOutput = history.outputs[nodeId];
      console.log(`🔍 Node ${nodeId} output:`, nodeOutput);
      
      if (nodeOutput.images) {
        console.log(`🖼️ Node ${nodeId} has ${nodeOutput.images.length} images`);
        
        for (const imageInfo of nodeOutput.images) {
          console.log(`⬇️ Downloading media:`, imageInfo);
          
          const mediaUrl = `${serverUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type || 'output'}`;
          console.log(`🔗 Media URL: ${mediaUrl}`);
          
          const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
          const mediaType = getMediaTypeFromFilename(imageInfo.filename);
          const mimeType = getMimeType(imageInfo.filename);
          
          console.log(`✅ Downloaded ${mediaType}: ${imageInfo.filename}, size: ${mediaResponse.data.byteLength} bytes, mime: ${mimeType}`);
          
          const mediaData = {
            buffer: Buffer.from(mediaResponse.data),
            filename: imageInfo.filename,
            width: imageInfo.width || null,
            height: imageInfo.height || null,
            mediaType,
            mimeType
          };
          
          if (mediaType === 'video') {
            videos.push(mediaData);
          } else {
            images.push(mediaData);
          }
        }
      }
      
      if (nodeOutput.gifs) {
        console.log(`🎬 Node ${nodeId} has ${nodeOutput.gifs.length} gifs/videos`);
        
        for (const gifInfo of nodeOutput.gifs) {
          console.log(`⬇️ Downloading gif/video:`, gifInfo);
          
          const mediaUrl = `${serverUrl}/view?filename=${gifInfo.filename}&subfolder=${gifInfo.subfolder || ''}&type=${gifInfo.type || 'output'}`;
          console.log(`🔗 Media URL: ${mediaUrl}`);
          
          const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
          const mediaType = getMediaTypeFromFilename(gifInfo.filename);
          const mimeType = getMimeType(gifInfo.filename);
          
          console.log(`✅ Downloaded ${mediaType}: ${gifInfo.filename}, size: ${mediaResponse.data.byteLength} bytes, mime: ${mimeType}`);
          
          const mediaData = {
            buffer: Buffer.from(mediaResponse.data),
            filename: gifInfo.filename,
            width: gifInfo.width || null,
            height: gifInfo.height || null,
            mediaType,
            mimeType
          };
          
          if (mediaType === 'video' || mediaType === 'animated') {
            videos.push(mediaData);
          } else {
            images.push(mediaData);
          }
        }
      }
      
      // 오디오 출력 (#805) — SaveAudio / SaveAudioMP3 / SaveAudioOpus 는
      // `audio` 키로 [{filename, subfolder, type}] 을 돌려준다 (width/height 없음).
      if (nodeOutput.audio) {
        console.log(`🔊 Node ${nodeId} has ${nodeOutput.audio.length} audio outputs`);

        for (const audioInfo of nodeOutput.audio) {
          const mediaUrl = `${serverUrl}/view?filename=${encodeURIComponent(audioInfo.filename)}&subfolder=${encodeURIComponent(audioInfo.subfolder || '')}&type=${audioInfo.type || 'output'}`;
          const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
          const mimeType = getMimeType(audioInfo.filename);

          console.log(`✅ Downloaded audio: ${audioInfo.filename}, size: ${mediaResponse.data.byteLength} bytes, mime: ${mimeType}`);

          audios.push({
            buffer: Buffer.from(mediaResponse.data),
            filename: audioInfo.filename,
            mediaType: 'audio',
            mimeType,
          });
        }
      }

      if (!nodeOutput.images && !nodeOutput.gifs && !nodeOutput.audio) {
        console.log(`ℹ️ Node ${nodeId} has no images, gifs or audio`);
      }
    }
  } else {
    console.warn('⚠️ No outputs in history');
  }
  
  console.log(`🎉 Successfully processed ${images.length} images, ${videos.length} videos, ${audios.length} audios`);
  return { images, videos, audios };
};

/** 사용자가 취소해 대기를 끝냈다는 표시. 실패와 구분한다 (#1327) */
const cancelledError = () => Object.assign(new Error('Job cancelled'), { code: 'ERR_CANCELED', name: 'CanceledError' });

/**
 * ComfyUI 에 넘어간 prompt 하나를 취소한다 (#1327).
 *
 * 같은 ComfyUI 서버를 다른 사용자 · 다른 도구가 함께 쓴다. 그래서 **이 prompt 만** 겨눈다.
 *
 * - 서버의 작업별 취소(`POST /api/jobs/{id}/cancel`)를 쓴다. 대기 중이면 대기열에서 빼고, 실행 중이면
 *   "지금 실행 중인 것이 이 id 인지"와 중단을 서버가 한 잠금 안에서 처리한다.
 * - `/interrupt` 는 쓰지 않는다. id 를 붙여 보내도 서버가 확인과 중단을 따로 해서, 그 사이 내 작업이 끝나고
 *   남의 작업이 시작되면 남의 작업이 멈춘다. id 를 안 읽는 옛 서버에서는 늘 전체 중단이다.
 * - 작업별 취소가 없는 옛 서버에서는 대기열에서 그 id 를 빼는 것까지만 한다. 이미 실행 중이면 그대로 둔다
 *   (끝나면 결과만 버린다).
 * - id 를 모르면 아무것도 하지 않는다.
 *
 * @returns {Promise<{ action: 'none'|'cancelled'|'dequeue-requested', reason?: string }>}
 */
const cancelPrompt = async (serverUrl, promptId) => {
  if (!serverUrl || typeof promptId !== 'string' || !promptId) return { action: 'none', reason: 'no-prompt-id' };
  const opts = { timeout: 8000 };
  try {
    const { data } = await axios.post(`${serverUrl}/api/jobs/${encodeURIComponent(promptId)}/cancel`, {}, opts);
    if (typeof data?.cancelled === 'boolean') {
      return data.cancelled ? { action: 'cancelled' } : { action: 'none', reason: 'not-in-queue' };
    }
    return { action: 'none', reason: 'unexpected-response' };
  } catch (error) {
    const status = error.response?.status;
    if (status !== 404 && status !== 405) {
      console.error(`⚠️ ComfyUI 취소 요청 실패 (prompt ${promptId}): ${error.message}`);
      return { action: 'none', reason: 'unreachable' };
    }
  }
  // 작업별 취소가 없는 서버 — id 를 지정한 대기열 삭제만
  try {
    await axios.post(`${serverUrl}/queue`, { delete: [promptId] }, opts);
    return { action: 'dequeue-requested', reason: 'no-job-cancel-api' };
  } catch (error) {
    console.error(`⚠️ ComfyUI 대기열 삭제 실패 (prompt ${promptId}): ${error.message}`);
    return { action: 'none', reason: 'unreachable' };
  }
};

/** 제출 요청이 나가 있는 사이 취소되면 응답을 이만큼만 더 기다린다 */
const SUBMIT_GRACE_AFTER_CANCEL_MS = 10000;

/**
 * @param {{ signal?: AbortSignal }} [options] `signal` 은 **사용자 취소 전용**이다 (#1327).
 *   시간 초과 · 서버 종료에는 쓰지 않는다 — 그 경로는 ComfyUI 작업을 살려 둔다 (#755).
 */
const submitWorkflow = async (serverUrl, workflowJson, progressCallback, executionTimeout = 300000, { signal } = {}) => {
  const clientId = uuidv4();
  if (signal?.aborted) throw cancelledError();

  console.log(`🔗 ComfyUI Service: Connecting to ${serverUrl}`);
  console.log(`🆔 Client ID: ${clientId}`);

  let ws = null;
  let handedOff = false;   // 대기 단계로 넘어가면 소켓 정리는 그쪽이 맡는다
  try {
    // 1. WebSocket을 먼저 연결 (ComfyUI 공식 패턴: connect → prompt 순서)
    //    캐시 히트나 빠른 모델의 경우 POST 직후 완료 메시지가 발생하므로
    //    반드시 WebSocket이 먼저 준비되어야 메시지를 놓치지 않음
    ws = new WebSocket(`${serverUrl.replace('http', 'ws')}/ws?clientId=${clientId}`);

    // WebSocket 연결 대기 — 그 사이 취소되면 바로 끝낸다 (#1327)
    await new Promise((resolve, reject) => {
      let onAbortConnect = null;
      const done = (fn, arg) => {
        clearTimeout(connectTimeout);
        if (onAbortConnect) signal.removeEventListener('abort', onAbortConnect);
        fn(arg);
      };
      const connectTimeout = setTimeout(() => done(reject, new Error('WebSocket connection timeout')), 10000);
      if (signal) {
        onAbortConnect = () => done(reject, cancelledError());
        signal.addEventListener('abort', onAbortConnect, { once: true });
      }
      ws.on('open', () => {
        console.log(`WebSocket connected to ComfyUI`);
        done(resolve);
      });
      ws.on('error', (error) => done(reject, new Error(`WebSocket connection error: ${error.message}`)));
    });
    if (signal?.aborted) throw cancelledError();

    // 2. WebSocket 연결 후 워크플로우 제출
    //    prompt id 를 우리가 정해 보낸다 — 응답을 못 받아도 그 id 로 취소할 수 있다 (#1327).
    //    id 를 받지 않는 옛 서버는 자기가 정한 id 를 돌려주므로 응답의 id 를 따른다.
    console.log(`📤 Submitting workflow to ComfyUI...`);
    const requestedPromptId = uuidv4();
    const submitting = axios.post(`${serverUrl}/prompt`, {
      prompt: workflowJson,
      client_id: clientId,
      prompt_id: requestedPromptId
    });

    let promptResponse;
    if (!signal) {
      promptResponse = await submitting;
    } else {
      // 제출 중 취소: 응답을 잠깐 더 기다렸다가, 오든 안 오든 그 id 를 취소하고 끝낸다
      let onAbortSubmit = null;
      let graceTimer = null;
      const aborted = new Promise((resolve) => {
        onAbortSubmit = () => { graceTimer = setTimeout(() => resolve('gave-up'), SUBMIT_GRACE_AFTER_CANCEL_MS); };
        if (signal.aborted) onAbortSubmit();
        else signal.addEventListener('abort', onAbortSubmit, { once: true });
      });
      let outcome;
      try {
        outcome = await Promise.race([submitting, aborted]);
      } finally {
        signal.removeEventListener('abort', onAbortSubmit);
        if (graceTimer) clearTimeout(graceTimer);
      }
      if (outcome === 'gave-up') {
        submitting.catch(() => {});   // 늦게 오는 실패가 처리 안 된 거절이 되지 않게
        const result = await cancelPrompt(serverUrl, requestedPromptId);
        console.log(`🚫 Prompt ${requestedPromptId} cancelled while submitting (no response) — ComfyUI: ${result.action}${result.reason ? ` (${result.reason})` : ''}`);
        throw cancelledError();
      }
      promptResponse = outcome;
    }

    const promptId = promptResponse.data.prompt_id;
    console.log(`✅ Workflow submitted successfully, Prompt ID: ${promptId}`);
    console.log(`📊 Prompt response:`, promptResponse.data);
    handedOff = true;

    // 3. WebSocket으로 완료 대기
    //    executing { node: null }은 히스토리 저장 후 전송되므로 가장 안전한 완료 신호
    return new Promise((resolve, reject) => {
      let currentProgress = 0;
      let settled = false;
      let livenessTimer = null;
      let pollTimer = null;
      let livenessFailures = 0;
      const timeoutSec = Math.round(executionTimeout / 1000);

      let onAbort = null;
      const cleanup = () => {
        if (livenessTimer) clearTimeout(livenessTimer);
        if (pollTimer) clearInterval(pollTimer);
        if (onAbort && signal) signal.removeEventListener('abort', onAbort);
      };
      const safeResolve = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        try { ws.close(1000); } catch (_) { /* already closed */ }
        resolve(value);
      };
      const safeReject = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        try { ws.close(); } catch (_) { /* already closed */ }
        reject(error);
      };

      const fetchHistoryEntry = async () => {
        const historyResponse = await axios.get(`${serverUrl}/history/${promptId}`, { timeout: 15000 });
        return historyResponse.data?.[promptId] || null;
      };
      const isInComfyQueue = async () => {
        const queueResponse = await axios.get(`${serverUrl}/queue`, { timeout: 15000 });
        const entries = [
          ...(queueResponse.data?.queue_running || []),
          ...(queueResponse.data?.queue_pending || [])
        ];
        // 큐 엔트리 형식: [number, prompt_id, prompt, ...]
        return entries.some((entry) => Array.isArray(entry) && entry[1] === promptId);
      };
      const extractHistoryError = (history) => {
        const messages = history?.status?.messages || [];
        for (const msg of messages) {
          if (Array.isArray(msg) && msg[0] === 'execution_error') {
            return msg[1]?.exception_message;
          }
        }
        return null;
      };
      // history 에 결과가 있으면 수거하고 true. 오류로 끝났으면 reject 후 true. 아직 없으면 false.
      const tryCompleteFromHistory = async () => {
        const history = await fetchHistoryEntry();
        if (settled) return true;   // 조회하는 사이 끝났으면 (취소 등) 결과를 받지 않는다
        if (!history) return false;
        if (history.status?.status_str === 'error') {
          safeReject(new Error(`ComfyUI execution error: ${extractHistoryError(history) || 'Unknown error'}`));
          return true;
        }
        const result = await processHistoryResult(serverUrl, history);
        safeResolve({ ...result, promptId });
        return true;
      };

      // 사용자 취소 (#1327): ComfyUI 에서 이 prompt 만 취소하고 대기를 바로 끝낸다.
      // 제출 요청이 나가 있는 사이 취소됐으면 여기서 바로 처리된다.
      if (signal) {
        onAbort = () => {
          if (settled) return;
          // 먼저 취소로 끝낸다 — ComfyUI 응답을 기다리는 사이 다른 신호(오류 · 완료)가 결말을 바꾸지 못하게
          safeReject(cancelledError());
          cancelPrompt(serverUrl, promptId).then((outcome) => {
            console.log(`🚫 Prompt ${promptId} cancelled by user — ComfyUI: ${outcome.action}${outcome.reason ? ` (${outcome.reason})` : ''}`);
          });
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }

      // liveness 기반 타임아웃 (#755): 만료 시점에 즉시 실패시키지 않고 완료/생존을 확인한다.
      // ComfyUI 큐에 살아있으면 대기를 연장 — "ComfyUI 는 도는데 vcc 는 실패" 불일치 제거.
      // timeout 설정의 의미는 완주 제한이 아니라 생존 확인 주기 + 실종 판정이 된다.
      const armLivenessTimer = () => {
        if (settled) return;   // 확인이 도는 사이 끝났으면 타이머를 다시 걸지 않는다
        livenessTimer = setTimeout(async () => {
          if (settled) return;
          try {
            if (await tryCompleteFromHistory()) return;
            if (await isInComfyQueue()) {
              livenessFailures = 0;
              console.log(`⏳ Prompt ${promptId} still in ComfyUI queue after ${timeoutSec}s — extending wait (#755)`);
              armLivenessTimer();
              return;
            }
            safeReject(new Error(`Workflow execution timeout (${timeoutSec}s) — prompt not found in ComfyUI queue/history`));
          } catch (checkError) {
            livenessFailures += 1;
            if (livenessFailures >= 3) {
              safeReject(new Error(`Workflow execution timeout (${timeoutSec}s) — ComfyUI unreachable during liveness check: ${checkError.message}`));
              return;
            }
            console.warn(`⚠️ Liveness check failed (${livenessFailures}/3): ${checkError.message} — retrying`);
            armLivenessTimer();
          }
        }, executionTimeout);
      };
      armLivenessTimer();

      // WS 가 끊겨도 실패시키지 않고 history/queue 폴링으로 재매칭 (#755)
      const startPolling = (reason) => {
        if (settled || pollTimer) return;
        console.log(`🔁 ${reason} — switching to history polling for prompt ${promptId} (#755)`);
        pollTimer = setInterval(async () => {
          if (settled) return;
          try {
            if (await tryCompleteFromHistory()) return;
            if (!(await isInComfyQueue())) {
              // 완료 직후 history 반영 전 race 대비 재확인
              if (!(await tryCompleteFromHistory())) {
                safeReject(new Error(`ComfyUI prompt disappeared (not in queue/history) after: ${reason}`));
              }
            }
          } catch (pollError) {
            console.warn(`⚠️ Polling check failed: ${pollError.message}`);
          }
        }, 10000);
      };

      ws.on('message', async (data, isBinary) => {
        // ComfyUI sends binary messages (image previews, etc.) — skip them
        if (isBinary) return;

        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'progress' && message.data.prompt_id === promptId) {
            currentProgress = Math.round((message.data.value / message.data.max) * 100);
            if (progressCallback) {
              progressCallback(currentProgress);
            }
          }

          if (message.type === 'executing' && message.data.prompt_id === promptId && message.data.node === null) {
            try {
              console.log(`📚 Fetching history for prompt ${promptId}...`);
              if (!(await tryCompleteFromHistory())) {
                // 히스토리 반영 직전 race — 폴링으로 마저 수거
                startPolling('History not ready at completion signal');
              }
            } catch (error) {
              safeReject(error);
            }
          }

          if (message.type === 'execution_error' && message.data.prompt_id === promptId) {
            safeReject(new Error(`ComfyUI execution error: ${message.data.exception_message || 'Unknown error'}`));
          }
        } catch (parseError) {
          console.error('Error parsing WebSocket message:', parseError);
        }
      });

      ws.on('error', (error) => {
        if (settled) return;
        startPolling(`WebSocket error: ${error.message}`);
      });

      ws.on('close', (code, reason) => {
        if (settled) return;
        if (code !== 1000) {
          startPolling(`WebSocket closed unexpectedly: ${code} ${reason}`);
        }
      });
    });
  } catch (error) {
    // 대기 단계로 넘어가기 전에 끝났으면 소켓을 여기서 닫는다
    if (!handedOff && ws) { try { ws.close(); } catch (_) { /* already closed */ } }
    if (error.code === 'ERR_CANCELED' && signal?.aborted) throw error;   // 취소는 제출 실패가 아니다 (#1327)
    // ComfyUI 응답 본문 로깅 — 400 등 에러 시 root cause (validation 메시지 / node mismatch 등) 보존
    const respBody = error.response?.data ? JSON.stringify(error.response.data).substring(0, 1500) : '';
    if (respBody) {
      console.error('❌ ComfyUI 응답 본문:', respBody);
    }
    throw new Error(`Failed to submit workflow: ${error.message}${respBody ? ` | body: ${respBody}` : ''}`);
  }
};

const getServerInfo = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/system_stats`, {
      timeout: 5000
    });
    return {
      available: true,
      stats: response.data
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
};

const getObjectInfo = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info`, {
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get object info: ${error.message}`);
  }
};

/**
 * ComfyUI-Manager 의 node→repo 매핑 조회 (#614, 방어적).
 * Manager 미설치/엔드포인트 차이로 실패하면 null 반환(예외 던지지 않음).
 * 알려진 엔드포인트를 순서대로 시도한다.
 */
const fetchNodeRepoMap = async (serverUrl) => {
  const endpoints = [
    // Manager v4 (ComfyUI 내장, #609 P4) — /v2 경로가 우선
    `${serverUrl}/v2/customnode/getmappings?mode=nightly`,
    `${serverUrl}/v2/customnode/getmappings?mode=local`,
    // 구버전 Manager 폴백
    `${serverUrl}/customnode/getmappings?mode=local`,
    `${serverUrl}/customnode/getmappings?mode=nickname`,
    `${serverUrl}/api/customnode/getmappings?mode=local`,
  ];
  for (const url of endpoints) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      if (response.data && typeof response.data === 'object') {
        return response.data; // 정규화는 workflowConverterService.normalizeManagerMap 가 담당
      }
    } catch {
      // 다음 엔드포인트 시도
    }
  }
  return null; // Manager 없음 / 조회 실패
};


// ── ComfyUI-Manager v4 (내장 Manager, #609 P4) ─────────────────────
// /api/features 의 extension.manager.supports_v4 로 가용성 판단.
const managerV4Available = async (serverUrl) => {
  try {
    const r = await axios.get(`${serverUrl}/api/features`, { timeout: 8000 });
    return !!r.data?.extension?.manager?.supports_v4;
  } catch {
    return false;
  }
};

// 커스텀 노드 설치 태스크 큐잉 — informed one-click 의 실행부.
// installId = cnr 팩 id('was-ns') 또는 github slug/URL. 큐잉 후 start 를 호출해야 처리 시작.
const managerQueueInstall = async (serverUrl, installId, uiId) => {
  await axios.post(`${serverUrl}/v2/manager/queue/task`, {
    ui_id: uiId,
    client_id: 'vcc-manager',
    kind: 'install',
    params: { id: installId, version: 'latest', selected_version: 'latest', mode: 'remote', channel: 'default' },
  }, { timeout: 15000 });
  await axios.post(`${serverUrl}/v2/manager/queue/start`, {}, { timeout: 15000 });
};

const managerQueueStatus = async (serverUrl) => {
  const r = await axios.get(`${serverUrl}/v2/manager/queue/status`, { timeout: 8000 });
  return r.data;
};

const managerHistoryEntry = async (serverUrl, uiId) => {
  const r = await axios.get(`${serverUrl}/v2/manager/queue/history`, { timeout: 8000 });
  return r.data?.history?.[uiId] || null;
};

// 재시작 — 프로세스가 내려가며 연결이 끊기는 것(ECONNRESET 등)이 정상 신호다.
const managerReboot = async (serverUrl) => {
  try {
    await axios.post(`${serverUrl}/v2/manager/reboot`, {}, { timeout: 8000 });
    return true;
  } catch (e) {
    if (e.code === 'ECONNRESET' || e.code === 'ECONNABORTED' || e.code === 'ECONNREFUSED') return true;
    if (e.response) throw new Error(`재시작 요청 거부 (${e.response.status}) — Manager 보안 정책을 확인하세요.`);
    throw e;
  }
};

const validateWorkflow = async (serverUrl, workflowJson) => {
  try {
    const response = await axios.post(`${serverUrl}/prompt`, {
      prompt: workflowJson,
      validate_only: true
    });
    
    return {
      valid: true,
      errors: []
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error.response?.data?.error || error.message]
    };
  }
};

const interruptExecution = async (serverUrl) => {
  try {
    await axios.post(`${serverUrl}/interrupt`);
    return true;
  } catch (error) {
    console.error('Failed to interrupt execution:', error);
    return false;
  }
};

const getQueue = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/queue`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to get queue: ${error.message}`);
  }
};

const getLoraModels = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info/LoraLoader`);
    const loraLoader = response.data?.LoraLoader;
    
    if (loraLoader && loraLoader.input && loraLoader.input.required && loraLoader.input.required.lora_name) {
      const models = loraLoader.input.required.lora_name[0] || [];
      return [...models].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }
    
    return [];
  } catch (error) {
    throw new Error(`Failed to get LoRA models: ${error.message}`);
  }
};

const getCheckpointModels = async (serverUrl) => {
  try {
    const response = await axios.get(`${serverUrl}/object_info/CheckpointLoaderSimple`);
    const checkpointLoader = response.data?.CheckpointLoaderSimple;

    if (checkpointLoader && checkpointLoader.input && checkpointLoader.input.required && checkpointLoader.input.required.ckpt_name) {
      const models = checkpointLoader.input.required.ckpt_name[0] || [];
      return [...models].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    return [];
  } catch (error) {
    throw new Error(`Failed to get checkpoint models: ${error.message}`);
  }
};

// ComfyUI /upload/image 는 input 디렉토리에 파일을 저장하는 범용 엔드포인트 —
// 비디오도 같은 경로로 올리고 VHS LoadVideo 등에서 파일명으로 소비한다 (#753).
const uploadImage = async (serverUrl, imageBuffer, filename, contentType = 'image/png') => {
  const FormData = require('form-data');

  try {
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: filename,
      contentType
    });
    form.append('overwrite', 'true');

    console.log(`📤 Uploading file to ComfyUI: ${filename} (${contentType})`);

    const response = await axios.post(`${serverUrl}/upload/image`, form, {
      headers: {
        ...form.getHeaders()
      },
      // 비디오는 이미지보다 크므로 여유 있는 타임아웃 (#753)
      timeout: contentType.startsWith('video/') ? 120000 : 30000
    });
    
    console.log(`✅ Image uploaded successfully:`, response.data);
    
    return {
      success: true,
      name: response.data.name,
      subfolder: response.data.subfolder || '',
      type: response.data.type || 'input'
    };
  } catch (error) {
    console.error(`❌ Failed to upload image to ComfyUI:`, error.message);
    throw new Error(`Failed to upload image to ComfyUI: ${error.message}`);
  }
};

module.exports = {
  submitWorkflow,
  managerV4Available,
  managerQueueInstall,
  managerQueueStatus,
  managerHistoryEntry,
  managerReboot,
  getServerInfo,
  getObjectInfo,
  fetchNodeRepoMap,
  validateWorkflow,
  interruptExecution,
  cancelPrompt,
  getQueue,
  getLoraModels,
  getCheckpointModels,
  uploadImage
};
