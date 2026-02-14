import axios from 'axios';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      window.location.href = '/login';
    }
    
    const message = error.response?.data?.message || 'An error occurred';
    toast.error(message);
    
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
  // LoRA 설정 API
  getLoraSettings: () => api.get('/admin/settings/lora'),
  updateLoraSettings: (data) => api.put('/admin/settings/lora', data),
};

export const backupAPI = {
  create: () => api.post('/admin/backup'),
  getStatus: (id) => api.get(`/admin/backup/status/${id}`),
  getLockStatus: () => api.get('/admin/backup/lock-status'),
  download: (id) => api.get(`/admin/backup/download/${id}`, { responseType: 'blob' }),
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
};

export const serverAPI = {
  getServers: (params) => api.get('/servers', { params }),
  getServer: (id) => api.get(`/servers/${id}`),
  createServer: (data) => api.post('/servers', data),
  updateServer: (id, data) => api.put(`/servers/${id}`, data),
  deleteServer: (id) => api.delete(`/servers/${id}`),
  checkServerHealth: (id) => api.post(`/servers/${id}/health-check`),
  checkAllServersHealth: () => api.post('/servers/health-check/all'),
  // LoRA 메타데이터 API
  getLoras: (id, params) => api.get(`/servers/${id}/loras`, { params }),
  syncLoras: (id, options = {}) => api.post(`/servers/${id}/loras/sync`, options),
  getLorasSyncStatus: (id) => api.get(`/servers/${id}/loras/status`),
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
};

export default api;