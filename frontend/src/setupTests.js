// vitest 공통 설정 (#808)
//
// @testing-library/jest-dom 은 toBeInTheDocument 같은 DOM matcher 를 추가한다.
// 이미 devDependencies 에 있었으나 러너가 없어 쓰이지 못하고 있었다.
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 테스트 간 DOM 잔재 제거 — 안 하면 같은 텍스트가 중복 매치되어 헷갈리는 실패가 난다
afterEach(() => cleanup());
