/**
 * 작업판 편집 — LoRA·모델 기본값 선택기의 허용 폴더 거름 (#1172)
 *
 * 편집 중인 허용 폴더를 목록 API 에 넘겨 서버가 거르게 하고(저장 전 값이라 판 id 대신 폴더),
 * 이미 저장된 기본값이 폴더 밖이면 알린다.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const listResponse = (items, folders) => ({
  data: { data: { loraModels: items, pagination: { current: 1, pages: 1, total: items.length }, restrictions: { folders, whitelist: false } } },
});

vi.mock('../../../services/api', () => ({
  serverAPI: {
    getLoras: vi.fn(),
    getDetailedModels: vi.fn(),
  },
}));
vi.mock('../../common/MetadataPickerModal', () => ({ default: () => null }));

import { serverAPI } from '../../../services/api';
import { ServerMetadataDefaultValueInput } from './shared';

const renderInput = (props) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ServerMetadataDefaultValueInput serverId="srv1" type="lora" value="" onChange={() => {}} label="기본값 (LoRA)" {...props} />
    </QueryClientProvider>,
  );
};

beforeEach(() => vi.clearAllMocks());

describe('기본값 선택기 — 허용 폴더 (#1172)', () => {
  test('편집 중인 허용 폴더를 목록 요청에 넘기고, 걸렀다고 알린다', async () => {
    serverAPI.getLoras.mockResolvedValue(listResponse([{ filename: 'style/Minimax/ref2va/a.safetensors' }], ['style/Minimax/ref2va/']));
    renderInput({ allowedFolders: ['style/Minimax/ref2va'] });
    await waitFor(() => expect(serverAPI.getLoras).toHaveBeenCalled());
    expect(serverAPI.getLoras.mock.calls[0][1]).toMatchObject({ allowedFolders: ['style/Minimax/ref2va'] });
    expect(await screen.findByText(/허용 폴더 style\/Minimax\/ref2va\/ 안/)).toBeInTheDocument();
  });

  test('허용 폴더가 없으면 예전처럼 폴더 없이 요청한다', async () => {
    serverAPI.getLoras.mockResolvedValue(listResponse([{ filename: 'a.safetensors' }], []));
    renderInput({ allowedFolders: [] });
    await waitFor(() => expect(serverAPI.getLoras).toHaveBeenCalled());
    expect(serverAPI.getLoras.mock.calls[0][1]).not.toHaveProperty('allowedFolders');
    expect(await screen.findByText('1개 중 선택')).toBeInTheDocument();
  });

  test('저장된 기본값이 허용 폴더 밖이면 다시 고르라고 알린다', async () => {
    serverAPI.getLoras.mockResolvedValue(listResponse([{ filename: 'style/Minimax/ref2va/a.safetensors' }], ['style/Minimax/ref2va/']));
    renderInput({ allowedFolders: ['style/Minimax/ref2va/'], value: 'style/Minimax/fl2va/b.safetensors' });
    expect(await screen.findByText(/지금 기본값은 허용 폴더\(style\/Minimax\/ref2va\/\) 밖입니다/)).toBeInTheDocument();
  });
});
