/**
 * 미디어 선택 다이얼로그의 신선도 계약 (#827)
 *
 * 전역 React Query 기본값은 staleTime 5분이다 (App.js). 선택 다이얼로그가 이걸 상속하면
 * 방금 생성한 이미지가 목록에 없고, 새로고침해야 나타난다 — 실제로 그렇게 새어나갔다.
 *
 * 이 계약은 눈에 잘 띄지 않는다. prop 하나가 빠져도 화면은 멀쩡히 그려지고, 캐시가 비어 있는
 * 첫 조회에서는 증상도 안 나온다. 그래서 값으로 고정해 둔다.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

// MediaGrid 를 가로채 넘어온 props 만 기록한다 — 렌더 결과가 아니라 계약을 본다.
const gridProps = [];
vi.mock('./MediaGrid', () => ({
  default: (props) => {
    gridProps.push(props);
    return null;
  },
}));

vi.mock('../../services/api', () => ({
  imageAPI: {
    getUploaded: vi.fn(),
    getGenerated: vi.fn(),
    getVideos: vi.fn(),
  },
}));

import ImageSelectDialog from './ImageSelectDialog';
import VideoSelectDialog from './VideoSelectDialog';

beforeEach(() => {
  gridProps.length = 0;
});

describe('선택 다이얼로그는 전역 5분 캐시를 상속하지 않는다 (#827)', () => {
  // 렌더 횟수는 StrictMode 등으로 늘 수 있어 세지 않는다. 마운트가 있었다는 것과
  // 모든 렌더가 staleTime 0 을 넘겼다는 것만 본다.
  test('ImageSelectDialog 가 staleTime 0 을 넘긴다', () => {
    render(<ImageSelectDialog open onClose={() => {}} onSelect={() => {}} />);
    expect(gridProps.length).toBeGreaterThan(0);
    expect(gridProps.map((p) => p.staleTime)).toEqual(gridProps.map(() => 0));
  });

  test('VideoSelectDialog 가 staleTime 0 을 넘긴다', () => {
    render(<VideoSelectDialog open onClose={() => {}} onSelect={() => {}} />);
    expect(gridProps.length).toBeGreaterThan(0);
    expect(gridProps.map((p) => p.staleTime)).toEqual(gridProps.map(() => 0));
  });

  test('닫힌 상태에서는 그리드가 아예 마운트되지 않는다', () => {
    // MUI Dialog 는 닫히면 자식을 언마운트한다. 이 전제가 깨지면 (keepMounted 등)
    // 다시 열어도 마운트가 없어 재조회가 일어나지 않는다 — staleTime 0 이 무의미해진다.
    render(<ImageSelectDialog open={false} onClose={() => {}} onSelect={() => {}} />);
    expect(gridProps).toHaveLength(0);
  });
});
