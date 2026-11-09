import { describe, expect, test, vi } from 'vitest';
import { fetchAllServerMetadata, METADATA_PAGE_SIZE, METADATA_MAX_PAGES } from './fetchAllServerMetadata';

// 백엔드처럼 정렬된 목록을 page·limit 로 잘라 돌려주는 가짜 fetcher. key 는 응답 목록 이름(loraModels / models)
function pagedFetcher(total, key = 'loraModels') {
  const all = Array.from({ length: total }, (_, i) => ({ filename: `lora-${String(i).padStart(4, '0')}.safetensors` }));
  return vi.fn(async (_serverId, { page = 1, limit = 50 }) => {
    const offset = (page - 1) * limit;
    return {
      data: {
        success: true,
        data: {
          [key]: all.slice(offset, offset + limit),
          pagination: { current: page, pages: Math.ceil(total / limit), total },
        },
      },
    };
  });
}

describe('서버 모델·LoRA 목록 전체 받기 (#1167)', () => {
  test('한 페이지를 넘는 목록을 순서대로 모두 합친다 — 418개면 317번째 뒤 항목도 들어온다', async () => {
    const fetcher = pagedFetcher(418);
    const r = await fetchAllServerMetadata(fetcher, 'srv', { detailed: true });
    expect(r.items).toHaveLength(418);
    expect(r.total).toBe(418);
    expect(r.truncated).toBe(false);
    expect(r.items[316].filename).toBe('lora-0316.safetensors');
    expect(r.items.map((m) => m.filename)).toEqual([...r.items.map((m) => m.filename)].sort());
    expect(fetcher).toHaveBeenCalledTimes(Math.ceil(418 / METADATA_PAGE_SIZE));
    // 넘긴 조건은 페이지마다 그대로 간다
    fetcher.mock.calls.forEach(([serverId, params]) => {
      expect(serverId).toBe('srv');
      expect(params.detailed).toBe(true);
      expect(params.limit).toBe(METADATA_PAGE_SIZE);
    });
  });

  test('한 페이지 안이면 한 번만 부른다', async () => {
    const fetcher = pagedFetcher(12, 'models');
    const r = await fetchAllServerMetadata(fetcher, 'srv');
    expect(r).toMatchObject({ total: 12, truncated: false });
    expect(r.items).toHaveLength(12);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('빈 목록도 0개로 끝난다', async () => {
    const r = await fetchAllServerMetadata(pagedFetcher(0), 'srv');
    expect(r).toEqual({ items: [], total: 0, truncated: false });
  });

  test('뒤 페이지를 못 받으면 일부만 돌려주지 않고 실패한다', async () => {
    const ok = pagedFetcher(418);
    const fetcher = vi.fn(async (id, params) => {
      if (params.page === 2) throw new Error('network');
      return ok(id, params);
    });
    await expect(fetchAllServerMetadata(fetcher, 'srv')).rejects.toThrow('network');
  });

  test('페이지 수 상한을 넘으면 잘랐다고 알린다', async () => {
    const total = METADATA_PAGE_SIZE * (METADATA_MAX_PAGES + 2);
    const fetcher = pagedFetcher(total);
    const r = await fetchAllServerMetadata(fetcher, 'srv');
    expect(fetcher).toHaveBeenCalledTimes(METADATA_MAX_PAGES);
    expect(r.items).toHaveLength(METADATA_PAGE_SIZE * METADATA_MAX_PAGES);
    expect(r.total).toBe(total);
    expect(r.truncated).toBe(true);
  });
});
