import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../components/common/ConfirmDialog';

// 페이지 렌더 스모크 (#902). 유닛 테스트는 순수 로직만 보기 때문에 "state 선언보다 위에서 참조"
// 같은 렌더 시 ReferenceError 를 못 잡았고, 그게 알파에서 두 번(#900 #902) 빈 화면으로 나타났다.
// 실제 데이터 모양으로 한 번 그려 보고, 선택 모드까지 켜 본다.

vi.mock('../services/api', () => {
  const job = {
    _id: 'job-1', status: 'completed', createdAt: '2026-08-30T10:00:00.000Z', actualTime: 22000, memo: '테스트 메모',
    workboardId: { _id: 'wb-1', name: 'Text to Image - Z-Image' },
    inputData: { prompt: 'a cat', aiModel: 'Z-Image\\z_image_turbo_bf16.safetensors', imageSize: '1216x832', tags: [] },
    resultImages: [{ _id: 'img-1', url: '/api/files/generated/a.png', metadata: { width: 1216, height: 832 } }],
    resultVideos: [], resultAudios: [],
  };
  const conv = { _id: 'conv-1', status: 'completed', createdAt: '2026-08-30T09:00:00.000Z', model: 'gpt', messages: [{ role: 'assistant', content: 'hi' }], workboardId: { _id: 'wb-2', name: 'GPT' } };
  return {
    jobAPI: { getMy: vi.fn().mockResolvedValue({ data: { jobs: [job] } }), getById: vi.fn(), bulkDelete: vi.fn(), delete: vi.fn(), retry: vi.fn(), cancel: vi.fn(), updateMemo: vi.fn() },
    conversationAPI: { getMy: vi.fn().mockResolvedValue({ data: { data: { conversations: [conv] } } }) },
    dashboardAPI: { getAllPipelineRuns: vi.fn().mockResolvedValue({ data: { data: { runs: [] } } }) },
    promptDataAPI: { create: vi.fn() },
    userAPI: { getProfile: vi.fn().mockResolvedValue({ data: { user: { preferences: {} } } }) },
    workboardAPI: { getById: vi.fn() },
    tagAPI: { getAll: vi.fn().mockResolvedValue({ data: { tags: [] } }) },
    default: {},
  };
});
vi.mock('../config', () => ({ default: { monitoring: { recentJobsInterval: false }, version: { major: 4, minor: 0 } } }));

import JobHistory from './JobHistory';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/jobs']}>
          <JobHistory />
        </MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>
  );
}

describe('JobHistory 페이지 렌더 스모크 (#902)', () => {
  test('작업·대화가 그려지고, 메모·소요 시간이 보인다', async () => {
    renderPage();
    expect(await screen.findByText('Text to Image - Z-Image')).toBeInTheDocument();
    expect(screen.getByText('테스트 메모')).toBeInTheDocument();
    expect(screen.getByText(/22초/)).toBeInTheDocument();
    expect(screen.getByText('GPT')).toBeInTheDocument();
  });

  test('선택 모드: 미디어 작업만 체크 가능, 선택 삭제 버튼에 개수', async () => {
    renderPage();
    await screen.findByText('Text to Image - Z-Image');
    fireEvent.click(screen.getByRole('button', { name: '선택' }));
    const cb = screen.getByLabelText('Text to Image - Z-Image 선택');
    expect(cb).not.toBeDisabled();
    expect(screen.getByLabelText('GPT 선택')).toBeDisabled();          // 대화는 선택 불가
    fireEvent.click(cb);
    expect(screen.getByRole('button', { name: /선택 삭제 \(1\)/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('전체 선택')).not.toBeInTheDocument());
  });
});
