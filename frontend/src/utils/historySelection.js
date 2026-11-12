// 작업 히스토리 멀티셀렉트 (#902) — 순수 로직. 화면은 Set 을 들고 여기 함수로만 바꾼다.
//
// 선택 대상은 "삭제할 수 있는 항목"이다: 이미지·영상·오디오 job 과 텍스트(대화) 중 처리 중이 아닌 것.
// 처리 중 작업은 서버가 거부한다. 파이프라인 실행은 히스토리에서 지우는 경로가 없어 제외한다.
// 대화는 #902 때 삭제 API 가 달라 뺐다가 #1188 에서 넣었다 (대화 삭제는 conversations API 로 따로 보낸다).

import { MEDIA_ITEM_TYPES } from './historyItems';

export function isSelectable(item) {
  if (!item || item.status === 'running') return false;
  if (item.kind === 'job') return MEDIA_ITEM_TYPES.includes(item.type);
  return item.kind === 'conv';
}

export function selectableIds(items) {
  return (items || []).filter(isSelectable).map((i) => i.id);
}

export function toggleId(selected, id) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

/** 보이는 항목이 전부 선택돼 있으면 해제, 아니면 전부 선택 */
export function toggleAll(selected, items) {
  const ids = selectableIds(items);
  const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
  return allOn ? new Set() : new Set(ids);
}

/** 목록이 바뀌면(필터·삭제·새로고침) 사라진 항목을 선택에서 뺀다 */
export function pruneSelection(selected, items) {
  const ids = new Set(selectableIds(items));
  const next = new Set([...selected].filter((id) => ids.has(id)));
  return next.size === selected.size ? selected : next;
}
