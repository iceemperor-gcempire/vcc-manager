// 작업판 관련 React Query 캐시 일괄 무효화 (#498).
//
// 배경: 작업판 목록/상세가 여러 화면에서 서로 다른 쿼리 키로 캐시된다
// (admin 목록 ['workboardCatalog', true], 사용자 목록 ['workboardCatalog', false],
//  편집기 상세 ['adminWorkboard', id], 실행화면 ['workboard', id], 대시보드 위젯 등).
// 과거에 각 뮤테이션이 제각각의 키만 무효화해(또는 #465 이전의 죽은 키 'adminWorkboards' 만)
// CRUD 후 다른 화면에 이전 정보가 남는 stale 문제가 반복됐다.
//
// 해결: 작업판을 변경하는 모든 뮤테이션(생성/수정/삭제/복제/활성토글/가져오기)은
// 이 헬퍼 하나만 호출한다. 새 목록 쿼리가 생겨도 아래 배열에만 키를 추가하면 된다.
//
// 키는 첫 원소로 부분 매칭한다 ({ queryKey: [root] }).
// 예: 'workboard' → ['workboard', id] 매칭, 'workboardCatalog' → ['workboardCatalog', true|false] 매칭.
// 'workboard' 가 'workboards' 를 잡지는 않는다 — 원소 단위로 같아야 한다.
//
// 반드시 필터 객체로 넘긴다 (#1241). @tanstack/react-query v5 에 문자열을 넘기면 queryKey 없는 필터가 되어
// 캐시의 모든 쿼리를 무효화한다. v3 → v5 전환(#526) 뒤로 그렇게 돌고 있었고, 그 덕에 아래 목록에 없는
// 화면도 우연히 새로 받고 있었다. 작업판을 보여 주는 쿼리를 새로 만들면 여기에 넣는다.
export const WORKBOARD_QUERY_ROOTS = [
  'workboardCatalog',          // admin/사용자 작업판 목록 (catalog 페이지)
  'adminWorkboard',            // 편집기 단일 상세
  'workboard',                 // 실행/프롬프트 화면의 단일 작업판
  'workboards',                // 작업판 선택 다이얼로그 등
  'promptWorkboards',          // 레거시 프롬프트 작업판
  'projectWorkboards',         // 프로젝트별 작업판 연결
  'dashboardWorkboardUsage',   // 대시보드 "자주 쓰는 작업판" 위젯
  'workboardFavorites',        // 즐겨찾기 작업판 (#1216) — 판을 끄거나 지우면 대시보드에서 빠져야 한다
  'adminDefaultValueMetadata', // 편집기 baseModel/lora 기본값 autocomplete 의 모델 목록
  'allWorkboards',             // 파이프라인 단계 picker 의 전체 작업판 목록 (#407)
  'allWorkboardsForPicker',    // 프로젝트에 작업판 추가 다이얼로그 (#396)
  'sequenceWorkboardPicker',   // 작업 절차 편집기의 작업판 picker
  'sequencePreviewInputs',     // 작업 절차 편집기의 입력 미리보기 — 판의 입력 칸으로 서버가 계산한다
];

export function invalidateWorkboardQueries(queryClient) {
  WORKBOARD_QUERY_ROOTS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
}

// 내 콘텐츠·작업 히스토리로 들어올 때 새로 받을 목록 (#829).
//
// 바깥(작업판 화면·다른 탭·MCP·API)에서 생긴 결과물은 이 화면들의 캐시가 모른다.
// 전역 staleTime(5분) 동안 옛 목록을 보여 주지 않도록, 들어올 때 목록 쿼리를 무효화한다.
// 화면 안에서 올리거나 지운 것은 각 뮤테이션이 따로 무효화한다.
//
// 내 콘텐츠에 탭(목록 쿼리 키)을 더하면 이 배열에도 넣는다.
export const REFRESH_ON_ENTER_PATHS = ['/jobs', '/content'];
export const REFRESH_ON_ENTER_ROOTS = [
  'historyJobs',      // 작업 히스토리
  'generatedImages',  // 내 콘텐츠 — 생성 이미지
  'uploadedImages',   //            업로드 이미지
  'generatedVideos',  //            생성 영상
  'generatedAudios',  //            생성 오디오
  'uploadedAudios',   //            업로드 오디오
  'generatedTexts',   //            생성 텍스트
  'uploadedTexts',    //            업로드 텍스트
  'contentCount',     //            탭 옆 개수 (staleTime 60초)
];

export function refreshListsOnEnter(queryClient, pathname) {
  if (!REFRESH_ON_ENTER_PATHS.includes(pathname)) return false;
  REFRESH_ON_ENTER_ROOTS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  return true;
}
