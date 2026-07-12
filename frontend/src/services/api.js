import axios from 'axios';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

function deriveErrorMessage(error) {
  // 1. 백엔드가 보낸 message 우선
  const apiMessage = error.response?.data?.message || error.response?.data?.error?.message;
  if (apiMessage) return apiMessage;

  // 2. axios timeout
  if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
    return '서버 응답이 시간 초과되었습니다. 잠시 후 다시 시도해주세요.';
  }

  // 3. 응답 자체가 없는 경우 (네트워크 / CORS / DNS 등)
  if (!error.response) {
    return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.';
  }

  // 4. status 별 일반 메시지
  const status = error.response.status;
  if (status >= 500) return `서버 오류가 발생했습니다 (HTTP ${status}). 잠시 후 다시 시도해주세요.`;
  if (status === 429) return '요청 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.';
  if (status === 403) return '권한이 없습니다.';
  if (status === 404) return '요청한 리소스를 찾을 수 없습니다.';
  return `요청 실패 (HTTP ${status})`;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      window.location.href = '/login';
    }

    toast.error(deriveErrorMessage(error));

    return Promise.reject(error);
  }
);

export const authAPI = {
  getProfile: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  getStatus: () => api.get('/auth/status'),
  signup: (data) => api.post('/auth/signup', data),
  signin: (data) => api.post('/auth/signin', data),
  checkEmail: (email) => api.get(`/auth/check-email/${encodeURIComponent(email)}`),
  checkNickname: (nickname) => api.get(`/auth/check-nickname/${encodeURIComponent(nickname)}`),
  requestPasswordReset: (email) => api.post('/auth/forgot-password', { email }),
  verifyResetToken: (token) => api.get(`/auth/verify-reset-token/${token}`),
  resetPassword: (data) => api.post('/auth/reset-password', data)
};

export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/password', data), // #663
  getStats: () => api.get('/users/stats'),
  deleteAccount: () => api.delete('/users/account'),
};

export const workboardAPI = {
  getAll: (params) => api.get('/workboards', { params }),
  getById: (id) => api.get(`/workboards/${id}`),
  getByIdAdmin: (id) => api.get(`/workboards/admin/${id}`), // 관리자 전용 - workflowData 포함
  create: (data) => api.post('/workboards', data),
  update: (id, data) => api.put(`/workboards/${id}`, data),
  delete: (id) => api.delete(`/workboards/${id}`),
  deactivate: (id) => api.patch(`/workboards/${id}/deactivate`),
  activate: (id) => api.patch(`/workboards/${id}/activate`),
  duplicate: (id, data) => api.post(`/workboards/${id}/duplicate`, data),
  getStats: (id) => api.get(`/workboards/${id}/stats`),
  getLoraModels: (id) => api.get(`/workboards/${id}/lora-models`),
  refreshLoraModels: (id) => api.post(`/workboards/${id}/lora-models/refresh`),
  export: (id) => api.get(`/workboards/${id}/export`),
  import: (data, serverId) => api.post('/workboards/import', { data, serverId }),
  // ComfyUI 워크플로 변환 (#607/#608)
  analyzeWorkflow: (workflow, serverId) => api.post('/workboards/analyze-workflow', { workflow, serverId }),
  draftFromWorkflow: (workflow, serverId) => api.post('/workboards/draft-from-workflow', { workflow, serverId }),
  resolveNodes: (serverId, nodes) => api.post('/workboards/resolve-nodes', { serverId, nodes }),
};

export const jobAPI = {
  create: (data) => api.post('/jobs/generate', data),
  createPromptJob: (data) => api.post('/jobs/generate-prompt', data),
  getMy: (params) => api.get('/jobs/my', { params }),
  getById: (id) => api.get(`/jobs/${id}`),
  delete: (id, deleteContent) => api.delete(`/jobs/${id}`, {
    params: { deleteContent },
  }),
  retry: (id) => api.post(`/jobs/${id}/retry`),
  cancel: (id) => api.post(`/jobs/${id}/cancel`),
  getQueueStats: () => api.get('/jobs/queue/stats'),
};

// LLM 대화 히스토리 (#373)
export const conversationAPI = {
  getMy: (params) => api.get('/conversations/my', { params }),
  getById: (id) => api.get(`/conversations/${id}`),
  delete: (id) => api.delete(`/conversations/${id}`),
  getAll: (params) => api.get('/conversations/all', { params }),
};

// 텍스트 컨텐츠 — UploadedText (직접 작성) / GeneratedText (대화에서 저장) (#387)
export const textAPI = {
  // 직접 작성
  getUploaded: (params) => api.get('/texts/uploaded', { params }),
  getUploadedById: (id) => api.get(`/texts/uploaded/${id}`),
  createUploaded: (data) => api.post('/texts/uploaded', data),
  updateUploaded: (id, data) => api.patch(`/texts/uploaded/${id}`, data),
  deleteUploaded: (id) => api.delete(`/texts/uploaded/${id}`),
  // 대화에서 저장
  getGenerated: (params) => api.get('/texts/generated', { params }),
  getGeneratedById: (id) => api.get(`/texts/generated/${id}`),
  createGenerated: (data) => api.post('/texts/generated', data),
  updateGenerated: (id, data) => api.patch(`/texts/generated/${id}`, data),
  deleteGenerated: (id) => api.delete(`/texts/generated/${id}`),
};

export const imageAPI = {
  upload: (formData) => api.post('/images/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  getUploaded: (params) => api.get('/images/uploaded', { params }),
  getGenerated: (params) => api.get('/images/generated', { params }),
  getUploadedById: (id) => api.get(`/images/uploaded/${id}`),
  getGeneratedById: (id) => api.get(`/images/generated/${id}`),
  updateUploaded: (id, data) => api.put(`/images/uploaded/${id}`, data),
  updateGenerated: (id, data) => api.put(`/images/generated/${id}`, data),
  deleteUploaded: (id) => api.delete(`/images/uploaded/${id}`),
  deleteGenerated: (id, deleteJob) => api.delete(`/images/generated/${id}`, {
    params: { deleteJob },
  }),
  getStats: () => api.get('/images/stats'),
  downloadGenerated: (id) => api.post(`/images/generated/${id}/download`, {}, {
    responseType: 'blob',
  }),
  getVideos: (params) => api.get('/images/videos', { params }),
  getVideoById: (id) => api.get(`/images/videos/${id}`),
  updateVideo: (id, data) => api.put(`/images/videos/${id}`, data),
  deleteVideo: (id, deleteJob) => api.delete(`/images/videos/${id}`, {
    params: { deleteJob },
  }),
  downloadVideo: (id) => api.post(`/images/videos/${id}/download`, {}, {
    responseType: 'blob',
  }),
  bulkDelete: (items, deleteJob) => api.post('/images/bulk-delete', { items, deleteJob }),
  bulkDeleteByFilter: (type, filters) => api.post('/images/bulk-delete-by-filter', { type, ...filters }),
};

export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  approveUser: (id) => api.post(`/admin/users/${id}/approve`),
  rejectUser: (id) => api.post(`/admin/users/${id}/reject`),
  getStats: () => api.get('/admin/stats'),
  getJobs: (params) => api.get('/admin/jobs', { params }),
  // 데이터 정합성 (#662 P2)
  getIntegrity: (params) => api.get('/admin/integrity', { params }),
  cleanupOwnerOrphans: (apply) => api.post('/admin/integrity/cleanup-owner-orphans', { apply }),
  // LoRA 설정 API
  getLoraSettings: () => api.get('/admin/settings/lora'),
  updateLoraSettings: (data) => api.put('/admin/settings/lora', data),
};

export const backupAPI = {
  create: () => api.post('/admin/backup'),
  getStatus: (id) => api.get(`/admin/backup/status/${id}`),
  getLockStatus: () => api.get('/admin/backup/lock-status'),
  download: (id) => api.get(`/admin/backup/download/${id}`, { responseType: 'blob' }),
  // signed URL 발급. 클라이언트는 받은 url 로 직접 navigate 해 브라우저 네이티브 스트림 다운로드 (#241).
  getSignedDownloadUrl: (id) => api.post(`/admin/backup/${id}/signed-url`),
  list: (params) => api.get('/admin/backup/list', { params }),
  delete: (id) => api.delete(`/admin/backup/${id}`),
  validate: (file) => {
    const formData = new FormData();
    formData.append('backup', file);
    return api.post('/admin/backup/restore/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  restore: (data) => api.post('/admin/backup/restore', data),
  getRestoreStatus: (id) => api.get(`/admin/backup/restore/status/${id}`),
  listRestores: (params) => api.get('/admin/backup/restore/list', { params }),
  // 서버사이드 복원 (업로드 우회 #634)
  listServerBackupFiles: () => api.get('/admin/backup/restore/server-files'),
  validateServerBackup: (fileName) => api.post('/admin/backup/restore/server-validate', { fileName }),
};

export const serverAPI = {
  getServers: (params) => api.get('/servers', { params }),
  getServer: (id) => api.get(`/servers/${id}`),
  createServer: (data) => api.post('/servers', data),
  updateServer: (id, data) => api.put(`/servers/${id}`, data),
  deleteServer: (id) => api.delete(`/servers/${id}`),
  checkServerHealth: (id) => api.post(`/servers/${id}/health-check`),
  checkAllServersHealth: () => api.post('/servers/health-check/all'),
  getCheckpointModels: (id, params) => api.get(`/servers/${id}/models`, { params }),
  // 모델 메타데이터 API (Phase E1+ - ServerModelCache 기반 detailed 응답)
  getDetailedModels: (id, params) => api.get(`/servers/${id}/models`, { params: { ...params, detailed: true } }),
  syncModels: (id, options = {}) => api.post(`/servers/${id}/models/sync`, options),
  getModelsSyncStatus: (id) => api.get(`/servers/${id}/models/status`),
  resetModelsSync: (id) => api.post(`/servers/${id}/models/sync/reset`),
  clearModelCache: (id) => api.delete(`/servers/${id}/models/cache`),
  // LoRA 메타데이터 API
  getLoras: (id, params) => api.get(`/servers/${id}/loras`, { params }),
  syncLoras: (id, options = {}) => api.post(`/servers/${id}/loras/sync`, options),
  getLorasSyncStatus: (id) => api.get(`/servers/${id}/loras/status`),
  resetLorasSync: (id) => api.post(`/servers/${id}/loras/sync/reset`),
  clearLoraCache: (id) => api.delete(`/servers/${id}/loras/cache`),
};

// 사용자 그룹 (#198)
export const groupAPI = {
  getMyGroups: () => api.get('/groups/me'),
  getAll: () => api.get('/groups'),
  getById: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  setMember: (id, userId, action = 'add') => api.post(`/groups/${id}/members`, { userId, action }),
};

export const promptDataAPI = {
  getAll: (params) => api.get('/prompt-data', { params }),
  getById: (id) => api.get(`/prompt-data/${id}`),
  create: (data) => api.post('/prompt-data', data),
  update: (id, data) => api.put(`/prompt-data/${id}`, data),
  delete: (id) => api.delete(`/prompt-data/${id}`),
  use: (id) => api.post(`/prompt-data/${id}/use`),
};

export const updatelogAPI = {
  get: (majorVersion) => api.get(`/updatelog/${majorVersion}`),
};

export const projectAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  getByTag: (tagId) => api.get(`/projects/by-tag/${tagId}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  toggleFavorite: (id) => api.post(`/projects/${id}/favorite`),
  getImages: (id, params) => api.get(`/projects/${id}/images`, { params }),
  getPromptData: (id, params) => api.get(`/projects/${id}/prompt-data`, { params }),
  getJobs: (id, params) => api.get(`/projects/${id}/jobs`, { params }),
  getFavorites: () => api.get('/projects/favorites'),
  // 작업판 멤버십 (#396)
  getWorkboards: (id) => api.get(`/projects/${id}/workboards`),
  addWorkboard: (id, workboardId) => api.post(`/projects/${id}/workboards/${workboardId}`),
  removeWorkboard: (id, workboardId) => api.delete(`/projects/${id}/workboards/${workboardId}`),
  // 프로젝트 컨텍스트로 실행된 LLM 대화 (#396)
  getConversations: (id, params) => api.get(`/projects/${id}/conversations`, { params }),
};

// 프로젝트 종속 파이프라인 (#397)
export const pipelineAPI = {
  list: (projectId) => api.get(`/projects/${projectId}/pipelines`),
  get: (projectId, pipelineId) => api.get(`/projects/${projectId}/pipelines/${pipelineId}`),
  create: (projectId, data) => api.post(`/projects/${projectId}/pipelines`, data),
  update: (projectId, pipelineId, data) => api.patch(`/projects/${projectId}/pipelines/${pipelineId}`, data),
  delete: (projectId, pipelineId) => api.delete(`/projects/${projectId}/pipelines/${pipelineId}`),
};

// 파이프라인 실행 영속 (#407)
export const pipelineRunAPI = {
  list: (projectId, params) => api.get(`/projects/${projectId}/pipeline-runs`, { params }),
  get: (projectId, runId) => api.get(`/projects/${projectId}/pipeline-runs/${runId}`),
  start: (projectId, data) => api.post(`/projects/${projectId}/pipeline-runs`, data),
  retry: (projectId, runId, data) => api.post(`/projects/${projectId}/pipeline-runs/${runId}/retry`, data),
  delete: (projectId, runId) => api.delete(`/projects/${projectId}/pipeline-runs/${runId}`),
};

// 대시보드 위젯 전용 집계 (#453)
export const dashboardAPI = {
  getActivePipelineRuns: () => api.get('/dashboard/active-pipeline-runs'),
  getImageTrend: (days = 7) => api.get('/dashboard/image-trend', { params: { days } }),
  getWorkboardUsage: (limit = 4) => api.get('/dashboard/workboard-usage', { params: { limit } }),
  // 작업 히스토리 통합 피드 — 전역(전 프로젝트) 파이프라인 런
  getAllPipelineRuns: (params) => api.get('/dashboard/pipeline-runs', { params }),
};

export const apiKeyAPI = {
  getAll: () => api.get('/apikeys'),
  create: (data) => api.post('/apikeys', data),
  revoke: (id) => api.delete(`/apikeys/${id}`),
};

export const tagAPI = {
  getAll: (params) => api.get('/tags', { params }),
  create: (data) => api.post('/tags', data),
  update: (id, data) => api.put(`/tags/${id}`, data),
  delete: (id) => api.delete(`/tags/${id}`),
  search: (params) => api.get('/tags/search', { params }),
  getMy: () => api.get('/tags/my'),
  // 세계관 역할 태그 — 없으면 자동 생성 (#396)
  getWorldview: () => api.get('/tags/worldview'),
  // 시스템 프롬프트 역할 태그 — 없으면 자동 생성 (#400)
  getSystemPrompt: () => api.get('/tags/system-prompt'),
  // 임의 name 으로 lookup / 자동 생성 — builtin / custom 무관
  getByName: (name) => api.get(`/tags/by-name/${encodeURIComponent(name)}`),
};

export default api;
