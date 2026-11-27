import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfirmProvider } from '../components/common/ConfirmDialog';

// 내 콘텐츠의 "모두 삭제"가 실제로 무엇을 보내는가 (#1314).
// 휴지통이 없어 되돌릴 수 없다. 화면에서 버튼을 눌러, 확인창에 보인 대상과 서버로 나가는 요청이 같은지 본다.

const img = (id, name) => ({ _id: id, originalName: name, url: `/api/files/generated/${id}.png`, tags: [], metadata: { width: 64, height: 64 }, createdAt: '2026-11-27T00:00:00.000Z' });
const page = (items, total = items.length) => ({ data: { images: items, videos: items, audios: items, pagination: { current: 1, pages: 1, total } } });

vi.mock('../services/api', () => {
  const list = () => vi.fn();
  return {
    imageAPI: {
      getGenerated: list(), getUploaded: list(), getVideos: list(), getAudios: list(), getUploadedAudios: list(),
      previewBulkDeleteByFilter: vi.fn(), bulkDeleteByFilter: vi.fn(), bulkDelete: vi.fn(),
      deleteGenerated: vi.fn(), deleteUploaded: vi.fn(), deleteVideo: vi.fn(), deleteAudio: vi.fn(), deleteUploadedAudio: vi.fn(),
      updateGenerated: vi.fn(), updateUploaded: vi.fn(), updateVideo: vi.fn(), upload: vi.fn(), uploadAudio: vi.fn(),
      downloadGenerated: vi.fn(), downloadVideo: vi.fn(),
    },
    userAPI: { getProfile: vi.fn() },
    textAPI: { getUploaded: vi.fn(), getGenerated: vi.fn() },
    projectAPI: { getAll: vi.fn() },
    tagAPI: { getMy: vi.fn(), getAll: vi.fn(), search: vi.fn() },
    default: {},
  };
});
vi.mock('../config', () => ({ default: { monitoring: {}, version: { major: 4, minor: 0 } } }));

import { imageAPI, userAPI, textAPI, projectAPI, tagAPI } from '../services/api';
import MyImages from './MyImages';

const ALL = [img('a'.repeat(24), 'cat-1.png'), img('b'.repeat(24), 'cat-2.png'), img('c'.repeat(24), 'dog.png')];
const CATS = ALL.slice(0, 2);

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/my-images']}>
          <MyImages />
        </MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>
  );
}

let resolveSearch; // 검색 응답을 붙잡아 두는 손잡이 — "새 목록을 기다리는 중"을 만든다

beforeEach(() => {
  vi.clearAllMocks();
  resolveSearch = null;
  userAPI.getProfile.mockResolvedValue({ data: { user: { preferences: {} } } });
  projectAPI.getAll.mockResolvedValue({ data: { projects: [] } });
  tagAPI.getMy.mockResolvedValue({ data: { tags: [] } });
  textAPI.getUploaded.mockResolvedValue({ data: { data: { items: [], pagination: { total: 0 } } } });
  textAPI.getGenerated.mockResolvedValue({ data: { data: { items: [], pagination: { total: 0 } } } });
  for (const fn of [imageAPI.getUploaded, imageAPI.getVideos, imageAPI.getAudios, imageAPI.getUploadedAudios]) fn.mockResolvedValue(page([]));
  imageAPI.getGenerated.mockImplementation((params = {}) => {
    if (params.search === 'cat') return Promise.resolve(page(CATS));
    if (params.search === 'slow') return new Promise((resolve) => { resolveSearch = () => resolve(page([ALL[2]])); });
    return Promise.resolve(page(ALL));
  });
  imageAPI.previewBulkDeleteByFilter.mockResolvedValue({ data: { success: true, data: { count: 2, digest: 'd'.repeat(64) } } });
  imageAPI.bulkDeleteByFilter.mockResolvedValue({ data: { success: true, data: { deleted: 2, failed: 0, errors: [] } } });
  imageAPI.bulkDelete.mockResolvedValue({ data: { success: true, data: { deleted: 1, failed: 0, errors: [] } } });
});

const searchBox = () => screen.getByPlaceholderText('이미지 이름이나 태그로 검색...');
const enterSelectMode = async () => fireEvent.click(await screen.findByRole('button', { name: '선택' }));
const deleteAllButton = () => screen.queryByRole('button', { name: /모두 삭제/ });

describe('내 콘텐츠 — 조건에 맞는 것 모두 삭제 (#1314)', () => {
  test('조건이 없으면 "모두 삭제"가 없다', async () => {
    renderPage();
    await enterSelectMode();
    await waitFor(() => expect(imageAPI.getGenerated).toHaveBeenCalled());
    expect(deleteAllButton()).toBeNull();
  });

  test('검색한 뒤 누르면 먼저 서버에 대상을 묻고, 확인창에 그 건수와 조건을 적는다', async () => {
    renderPage();
    await enterSelectMode();
    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    fireEvent.click(await screen.findByRole('button', { name: '검색된 2개 모두 삭제' }));

    await waitFor(() => expect(imageAPI.previewBulkDeleteByFilter).toHaveBeenCalledWith('generated', { search: 'cat' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('검색어 "cat" 조건에 맞는 2개 항목을 모두 삭제합니다.')).toBeInTheDocument();
    expect(imageAPI.bulkDeleteByFilter).not.toHaveBeenCalled(); // 확인 전에는 지우지 않는다
  });

  test('확인하면 확인창을 열 때의 종류 · 조건 · 지문 그대로 보낸다', async () => {
    renderPage();
    await enterSelectMode();
    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    fireEvent.click(await screen.findByRole('button', { name: '검색된 2개 모두 삭제' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(imageAPI.bulkDeleteByFilter).toHaveBeenCalledTimes(1));
    expect(imageAPI.bulkDeleteByFilter).toHaveBeenCalledWith('generated', { search: 'cat', deleteJob: false, expectedDigest: 'd'.repeat(64) });
  });

  test('취소하면 아무것도 보내지 않는다', async () => {
    renderPage();
    await enterSelectMode();
    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    fireEvent.click(await screen.findByRole('button', { name: '검색된 2개 모두 삭제' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(imageAPI.bulkDeleteByFilter).not.toHaveBeenCalled();
  });

  test('검색어를 바꿔 새 목록을 기다리는 동안에는 "모두 삭제"를 내지 않는다', async () => {
    renderPage();
    await enterSelectMode();
    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    await screen.findByRole('button', { name: '검색된 2개 모두 삭제' });

    fireEvent.change(searchBox(), { target: { value: 'slow' } }); // 응답이 아직 안 왔다 — 화면에는 cat 목록이 남아 있다
    await waitFor(() => expect(resolveSearch).toBeTypeOf('function'));
    expect(deleteAllButton()).toBeNull();
    expect(screen.getByRole('button', { name: '이 페이지 전체 선택' })).toBeDisabled();

    resolveSearch();
    expect(await screen.findByRole('button', { name: '검색된 1개 모두 삭제' })).toBeInTheDocument();
  });

  test('서버가 대상을 확인해 주지 못하면 확인창을 열지 않는다', async () => {
    imageAPI.previewBulkDeleteByFilter.mockRejectedValue({ response: { status: 400, data: { message: '삭제할 조건(검색어나 태그)이 필요합니다' } } });
    renderPage();
    await enterSelectMode();
    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    fireEvent.click(await screen.findByRole('button', { name: '검색된 2개 모두 삭제' }));
    await waitFor(() => expect(imageAPI.previewBulkDeleteByFilter).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(imageAPI.bulkDeleteByFilter).not.toHaveBeenCalled();
  });

  test('서버가 0건이라고 하면 확인창을 열지 않는다', async () => {
    imageAPI.previewBulkDeleteByFilter.mockResolvedValue({ data: { success: true, data: { count: 0, digest: 'e'.repeat(64) } } });
    renderPage();
    await enterSelectMode();
    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    fireEvent.click(await screen.findByRole('button', { name: '검색된 2개 모두 삭제' }));
    await waitFor(() => expect(imageAPI.previewBulkDeleteByFilter).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('내 콘텐츠 — 선택 삭제 (#1314)', () => {
  test('고른 뒤 검색어를 바꾸면 고른 것이 비워진다 — 화면에서 사라진 항목이 함께 지워지지 않는다', async () => {
    renderPage();
    await enterSelectMode();
    await screen.findByText('3개 선택됨', {}, { timeout: 50 }).catch(() => {});
    fireEvent.click(screen.getByRole('button', { name: '이 페이지 전체 선택' }));
    expect(await screen.findByText('3개 선택됨')).toBeInTheDocument();

    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    expect(await screen.findByText('0개 선택됨')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '선택 삭제' })).toBeDisabled();
  });

  test('확인하면 고른 id 와 그때의 종류로 보낸다', async () => {
    renderPage();
    await enterSelectMode();
    fireEvent.change(searchBox(), { target: { value: 'cat' } });
    await screen.findByRole('button', { name: '검색된 2개 모두 삭제' });
    fireEvent.click(screen.getByRole('button', { name: '이 페이지 전체 선택' }));
    expect(await screen.findByText('2개 선택됨')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '선택 삭제' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('선택한 2개 항목을 삭제합니다.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));

    await waitFor(() => expect(imageAPI.bulkDelete).toHaveBeenCalledTimes(1));
    expect(imageAPI.bulkDelete).toHaveBeenCalledWith(
      [{ id: 'a'.repeat(24), type: 'generated' }, { id: 'b'.repeat(24), type: 'generated' }], false);
    expect(imageAPI.bulkDeleteByFilter).not.toHaveBeenCalled();
  });
});
