import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { workboardAPI } from '../services/api';
import {
  buildSameWorkboardContinue,
  buildCrossWorkboardContinue,
  buildWorkboardPickerContinue,
  storeContinueJobData,
} from '../utils/continueJob';

// '계속하기' / '다른 작업판으로 이어가기' 실행 (#808).
//
// JobHistoryPanel(프로젝트 상세)과 pages/JobHistory(사이드바)가 같은 로직을 각자 갖고
// 있었다. 문구와 검증 순서만 달랐을 뿐 하는 일은 같았고, 그 갈라짐 때문에 #762 수정이
// 한쪽에만 적용되어 #792 로 재발했다. 페이로드 조립은 utils/continueJob 이 맡고,
// 여기서는 **작업판 검증 → 저장 → 이동** 흐름을 담당한다.
//
// 검증 실패는 전부 같은 결말이다 — 작업판 선택 페이지로 보내고 히스토리 값을 들려 보낸다.
// 사용자가 다른 작업판을 고르면 거기서 이어갈 수 있다.

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** job.workboardId 가 문자열일 수도, populate 된 객체일 수도 있다 */
export function extractWorkboardId(job) {
  const raw = job?.workboardId;
  if (typeof raw === 'string') return raw;
  return raw?._id || raw?.id || null;
}

/**
 * 작업판이 계속하기에 쓸 수 있는 상태인지 판정.
 * @returns {{ ok: true } | { ok: false, reason: string, message: string }}
 */
export function checkWorkboardUsable(workboardId, workboard) {
  if (!workboardId || workboardId === 'undefined' || workboardId === 'null') {
    return { ok: false, reason: 'missingId', message: '작업판 정보를 찾을 수 없습니다. 작업판 선택 페이지로 이동합니다.' };
  }
  if (!OBJECT_ID.test(workboardId)) {
    return { ok: false, reason: 'invalidId', message: '잘못된 작업판 ID입니다. 작업판 선택 페이지로 이동합니다.' };
  }
  if (!workboard) {
    return { ok: false, reason: 'notFound', message: '작업판을 찾을 수 없습니다. 작업판 선택 페이지로 이동합니다.' };
  }
  if (!workboard.isActive) {
    return { ok: false, reason: 'inactive', message: '작업판이 비활성화되었습니다. 작업판 선택 페이지로 이동합니다.' };
  }
  return { ok: true };
}

export function useContinueJob() {
  const navigate = useNavigate();

  const toPicker = (job, message) => {
    if (message) toast.error(message);
    storeContinueJobData(buildWorkboardPickerContinue(job));
    navigate('/workboards');
  };

  /** 같은 작업판에서 계속하기 */
  const continueSameWorkboard = async (job) => {
    const workboardId = extractWorkboardId(job);

    // id 자체가 문제면 API 를 부를 것도 없다
    const pre = checkWorkboardUsable(workboardId, undefined);
    if (!pre.ok && pre.reason !== 'notFound') return toPicker(job, pre.message);

    try {
      const res = await workboardAPI.getById(workboardId);
      const workboard = res.data?.workboard;

      const verdict = checkWorkboardUsable(workboardId, workboard);
      if (!verdict.ok) return toPicker(job, verdict.message);

      storeContinueJobData(buildSameWorkboardContinue({ workboardId, workboard, job }));
      navigate(`/generate/${workboardId}`);
      toast.success('작업 설정을 불러왔습니다');
    } catch (error) {
      // 403/404 는 권한·삭제 — 어느 쪽이든 선택 페이지로 보내는 결말이 같다
      const status = error.response?.status;
      const message = status === 404
        ? '작업판이 존재하지 않습니다. 작업판 선택 페이지로 이동합니다.'
        : status === 403
          ? '작업판 접근 권한이 없습니다. 작업판 선택 페이지로 이동합니다.'
          : '작업을 계속할 수 없습니다. 작업판 선택 페이지로 이동합니다.';
      toPicker(job, message);
    }
  };

  /** 다른 작업판으로 이어가기 — 사용자가 이미 작업판을 고른 뒤 */
  const continueCrossWorkboard = (job, workboard) => {
    const lastImage = job.resultImages?.length ? job.resultImages[job.resultImages.length - 1] : null;
    const lastVideo = job.resultVideos?.length ? job.resultVideos[job.resultVideos.length - 1] : null;
    storeContinueJobData(buildCrossWorkboardContinue({
      workboard, job, lastGeneratedMedia: { image: lastImage, video: lastVideo },
    }));
    navigate(`/generate/${workboard._id}`);
    toast.success('작업판이 선택되었습니다. 설정을 매칭합니다.');
  };

  return { continueSameWorkboard, continueCrossWorkboard };
}

export default useContinueJob;
