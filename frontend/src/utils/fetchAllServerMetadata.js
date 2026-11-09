// 서버 모델·LoRA 목록을 모든 페이지에 걸쳐 받아 합친다 (#1167).
// 백엔드 목록은 페이지로 나눠 오므로 첫 페이지만 받으면 그 뒤 항목은 고를 수 없다.
// 작업판 편집의 기본값 입력기가 `limit: 200` 첫 페이지만 받아, 418개 중 317번째 이후 LoRA 가 빠졌다.

export const METADATA_PAGE_SIZE = 200;
// 페이지 수 상한 — 서버가 엉뚱한 pages 를 돌려줘도 요청이 끝없이 늘지 않게 한다.
// 넘으면 잘랐다고 알린다 (truncated) — 조용히 자르지 않는다.
export const METADATA_MAX_PAGES = 50;

// 응답에서 목록을 꺼낸다 — 모델(`models`)·LoRA(`loraModels`) 등 응답 모양이 엔드포인트마다 다르다
export function pickMetadataItems(res) {
  const body = res?.data;
  return body?.data?.items
    || body?.data?.models
    || body?.data?.loraModels
    || body?.data?.loras
    || body?.models
    || body?.loraModels
    || body?.loras
    || [];
}

function pickPagination(res) {
  return res?.data?.data?.pagination || res?.data?.pagination || null;
}

// fetcher(serverId, params) → axios 응답. 반환: { items, total, truncated }
export async function fetchAllServerMetadata(fetcher, serverId, params = {}) {
  const query = (page) => fetcher(serverId, { ...params, page, limit: METADATA_PAGE_SIZE });

  const first = await query(1);
  const items = [...pickMetadataItems(first)];
  const pagination = pickPagination(first);
  const pages = Math.max(1, Number(pagination?.pages) || 1);
  const lastPage = Math.min(pages, METADATA_MAX_PAGES);

  if (lastPage > 1) {
    const rest = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, i) => query(i + 2)),
    );
    rest.forEach((res) => items.push(...pickMetadataItems(res)));
  }

  const total = Number.isFinite(Number(pagination?.total)) ? Number(pagination.total) : items.length;
  return { items, total, truncated: pages > lastPage || items.length < total };
}
