import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// 사용자 선택 ('light' | 'dark' | 'system') 와 system preference 를 통합해
// 실제 effective scheme ('light' | 'dark') 을 계산.
//
// 영속: localStorage. 백엔드 user preferences 까지 연동하면 디바이스 간 동기화 가능 — 후속.
const STORAGE_KEY = 'vcc.colorScheme';
const ColorSchemeContext = createContext(null);

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch (_) {}
  return 'system';
}

export function ColorSchemeProvider({ children }) {
  const [mode, setModeState] = useState(readStored);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );

  // prefers-color-scheme 변경 구독
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    // addEventListener for modern browsers, addListener for older
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  const setMode = (next) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    setModeState(next);
  };

  const effective = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  // tokens.css 의 [data-theme="dark"] 셀렉터 활용 위해 html 에 data-theme 부여
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', effective);
  }, [effective]);

  const value = useMemo(() => ({ mode, setMode, effective, systemDark }), [mode, effective, systemDark]);
  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorScheme() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) throw new Error('useColorScheme must be used inside ColorSchemeProvider');
  return ctx;
}
