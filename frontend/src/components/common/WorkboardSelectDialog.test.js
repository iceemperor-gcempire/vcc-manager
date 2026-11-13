import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// #1192 — 다른 작업판으로 이어가기 창의 검색. 작업판이 많아 스크롤로 찾기 어렵고,
// 목록 API 상한(50) 밖의 판은 창에 아예 안 나왔다.
vi.mock('../../services/api', () => ({
  workboardAPI: { getAll: vi.fn() },
}));

import WorkboardSelectDialog, { matchesWorkboardSearch, WORKBOARD_SELECT_LIMIT } from './WorkboardSelectDialog';
import { workboardAPI } from '../../services/api';

const BOARDS = [
  { _id: 'a', name: 'MiniMax H3 - FL2V (AV1)', description: '영상 + 스테레오 오디오', outputFormat: 'video' },
  { _id: 'b', name: 'Text to Image - Z-Image', description: '빠른 이미지', outputFormat: 'image' },
  { _id: 'c', name: 'Local Chat', description: '대화', outputFormat: 'text' },
  { _id: 'd', name: 'Sketch to Image - SDXL', description: 'H3 아님 — 스케치 구도', outputFormat: 'image' },
];

const reply = (workboards, total = workboards.length) => ({
  data: { workboards, pagination: { total, pages: 1, page: 1, limit: WORKBOARD_SELECT_LIMIT } },
});

const renderDialog = (props = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <WorkboardSelectDialog open onClose={() => {}} onSelect={onSelect} {...props} />
    </QueryClientProvider>
  );
  return { onSelect };
};

const searchBox = () => screen.getByRole('textbox', { name: '작업판 검색' });

describe('WorkboardSelectDialog 검색 (#1192)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workboardAPI.getAll.mockImplementation(async ({ search } = {}) => (
      reply(search ? BOARDS.filter((b) => matchesWorkboardSearch(b, search)) : BOARDS)
    ));
  });

  test('처음에는 검색어 없이 받고, 텍스트 판은 빼고 보여 준다', async () => {
    renderDialog();
    expect(await screen.findByText('MiniMax H3 - FL2V (AV1)')).toBeInTheDocument();
    expect(screen.getByText('Text to Image - Z-Image')).toBeInTheDocument();
    expect(screen.queryByText('Local Chat')).not.toBeInTheDocument();
    expect(workboardAPI.getAll).toHaveBeenCalledWith({ isActive: true, limit: WORKBOARD_SELECT_LIMIT });
  });

  test('입력하면 받아 둔 목록이 바로 줄고, 잠시 뒤 서버에도 검색어를 넘긴다', async () => {
    renderDialog();
    await screen.findByText('MiniMax H3 - FL2V (AV1)');
    fireEvent.change(searchBox(), { target: { value: 'z-image' } });
    // 서버 응답을 기다리지 않고 바로 걸러진다 (대소문자 무시)
    expect(screen.queryByText('MiniMax H3 - FL2V (AV1)')).not.toBeInTheDocument();
    expect(screen.getByText('Text to Image - Z-Image')).toBeInTheDocument();
    await waitFor(() => expect(workboardAPI.getAll).toHaveBeenCalledWith({ isActive: true, limit: WORKBOARD_SELECT_LIMIT, search: 'z-image' }));
  });

  test('설명으로도 찾는다', async () => {
    renderDialog();
    await screen.findByText('MiniMax H3 - FL2V (AV1)');
    fireEvent.change(searchBox(), { target: { value: '스케치' } });
    expect(screen.getByText('Sketch to Image - SDXL')).toBeInTheDocument();
    expect(screen.queryByText('Text to Image - Z-Image')).not.toBeInTheDocument();
  });

  test('받아 둔 50개 밖의 판도 서버 검색으로 나온다', async () => {
    const hidden = { _id: 'z', name: 'LTX-2.5 - FL2V', description: '', outputFormat: 'video' };
    workboardAPI.getAll.mockImplementation(async ({ search } = {}) => (
      search ? reply([hidden].filter((b) => matchesWorkboardSearch(b, search))) : reply(BOARDS, 80)
    ));
    renderDialog();
    await screen.findByText('MiniMax H3 - FL2V (AV1)');
    expect(screen.getByText(/많이 쓴 순으로 50개까지만 보입니다/)).toBeInTheDocument();
    fireEvent.change(searchBox(), { target: { value: 'ltx' } });
    expect(await screen.findByText('LTX-2.5 - FL2V')).toBeInTheDocument();
    expect(screen.queryByText(/50개까지만 보입니다/)).not.toBeInTheDocument();
  });

  test('맞는 판이 없으면 그렇게 알린다', async () => {
    renderDialog();
    await screen.findByText('MiniMax H3 - FL2V (AV1)');
    fireEvent.change(searchBox(), { target: { value: '없는판' } });
    expect(await screen.findByText('"없는판" 에 맞는 작업판이 없습니다.')).toBeInTheDocument();
  });

  test('Enter 는 첫 결과를 고르고, 한글 조합 중 Enter 는 고르지 않는다', async () => {
    const { onSelect } = renderDialog();
    await screen.findByText('MiniMax H3 - FL2V (AV1)');
    fireEvent.change(searchBox(), { target: { value: 'image' } });
    fireEvent.keyDown(searchBox(), { key: 'Enter', isComposing: true });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.keyDown(searchBox(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ _id: 'b' }));
  });

  test('지우기 버튼으로 검색어를 비우면 전체 목록으로 돌아간다', async () => {
    renderDialog();
    await screen.findByText('MiniMax H3 - FL2V (AV1)');
    fireEvent.change(searchBox(), { target: { value: 'sdxl' } });
    expect(screen.queryByText('MiniMax H3 - FL2V (AV1)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }));
    expect(searchBox()).toHaveValue('');
    expect(screen.getByText('MiniMax H3 - FL2V (AV1)')).toBeInTheDocument();
  });
});
