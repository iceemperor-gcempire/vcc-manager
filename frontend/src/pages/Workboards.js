import React from 'react';
import WorkboardCatalogPage from './WorkboardCatalogPage';

// 사용자 작업판 카탈로그(/workboards). 관리자 "작업판 관리"와 같은 레이아웃을
// 공유하되 admin=false 로 관리 UI 는 미표시. (#463 후속 통합)
function Workboards() {
  return <WorkboardCatalogPage admin={false} />;
}

export default Workboards;
