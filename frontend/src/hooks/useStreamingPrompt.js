import { useState, useRef, useCallback } from 'react';
import { streamPrompt } from '../services/streamChat';

// 텍스트 챗 스트리밍 공통 훅 (#490).
// send(payload, { onDone, onError }) 호출 시:
//  - 토큰이 올 때마다 streamingText 가 누적되어 컴포넌트가 실시간 렌더
//  - 완료 시 onDone(info, fullText) 호출 후 streamingText 초기화
//  - 에러 시 onError(error) 호출 후 streamingText 초기화
// isStreaming 으로 입력 잠금/스피너 제어.
export function useStreamingPrompt() {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const accRef = useRef('');

  const send = useCallback((payload, { onDone, onError } = {}) => {
    accRef.current = '';
    setStreamingText('');
    setIsStreaming(true);

    streamPrompt(payload, {
      onToken: (delta) => {
        accRef.current += delta;
        setStreamingText(accRef.current);
      },
      onDone: (info) => {
        const fullText = accRef.current;
        setIsStreaming(false);
        setStreamingText('');
        onDone?.(info, fullText);
      },
      onError: (err) => {
        setIsStreaming(false);
        setStreamingText('');
        onError?.(err);
      },
    });
  }, []);

  return { send, streamingText, isStreaming };
}
