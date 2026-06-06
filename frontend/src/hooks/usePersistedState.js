import { useState, useEffect } from 'react';

// useState 와 동일하지만 값을 localStorage 에 영속화한다 (#510).
// 화면을 떠났다가 돌아와도(언마운트→리마운트) 마지막 값이 복원된다 — 작업판 목록 필터 유지 등.
// key 가 falsy 면 영속화 없이 일반 useState 처럼 동작.
export function usePersistedState(key, initial) {
  const [value, setValue] = useState(() => {
    if (!key) return initial;
    try {
      const stored = localStorage.getItem(key);
      return stored != null ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 용량 초과 등 무시 */
    }
  }, [key, value]);

  return [value, setValue];
}
