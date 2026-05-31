import React from 'react';
import WorkboardCatalogPage from '../WorkboardCatalogPage';

// 관리자 "작업판 관리"(/admin/workboards). 사용자 작업판 카탈로그와 같은
// 레이아웃을 공유하며 admin=true 로 관리 UI(상태 필터·생성/가져오기·편집/메뉴·허용 그룹) 표시.
function WorkboardManagementPage() {
  return <WorkboardCatalogPage admin />;
}

export default WorkboardManagementPage;
