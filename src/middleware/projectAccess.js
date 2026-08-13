const Project = require('../models/Project');
const { userHasProjectAccess, userCanManageProject } = require('./auth');

// 프로젝트 로더 (#802).
//
// pipelines.js 와 pipelineRuns.js 가 각자 `loadProject` 를 갖고 있었고 둘 다
// `{ _id, userId: req.user._id }` 하드 필터였다. 그룹 공유(#802)가 들어오면서
// 판정이 한 곳에 있어야 하므로 여기로 모은다.
//
// 응답까지 처리하고 null 을 돌려주는 형태를 유지한다 — 기존 호출부가 그 관례로 쓰고 있다.

// 존재하지 않는 것과 권한이 없는 것을 **같은 404 로** 응답한다.
// 403 을 주면 "그 id 의 프로젝트가 존재한다" 는 사실이 새어 나간다.
const NOT_FOUND = { success: false, message: '프로젝트를 찾을 수 없습니다' };

/**
 * 읽기·실행용 로더. 소유자 + 공유 그룹 + admin.
 * @param {string} idParam — req.params 에서 프로젝트 id 를 담은 키
 */
function loadProjectForRead(idParam = 'projectId') {
  return async function (req, res) {
    const project = await Project.findById(req.params[idParam]);
    if (!project || !userHasProjectAccess(req.user, project)) {
      res.status(404).json(NOT_FOUND);
      return null;
    }
    return project;
  };
}

/**
 * 편집·삭제·내보내기용 로더. 소유자 + admin 만.
 * 공유 범위는 읽기 + 실행이므로 구조를 바꾸는 행위는 여기로 막는다.
 */
function loadProjectForManage(idParam = 'projectId') {
  return async function (req, res) {
    const project = await Project.findById(req.params[idParam]);
    if (!project || !userHasProjectAccess(req.user, project)) {
      res.status(404).json(NOT_FOUND);
      return null;
    }
    if (!userCanManageProject(req.user, project)) {
      res.status(403).json({ success: false, message: '이 프로젝트를 수정할 권한이 없습니다' });
      return null;
    }
    return project;
  };
}

module.exports = { loadProjectForRead, loadProjectForManage };
