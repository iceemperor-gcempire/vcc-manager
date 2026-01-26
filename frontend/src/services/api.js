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
  checkNickname: (nickname) => api.get(`/auth/check-nickname/${encodeURIComponent(nickname)}`)
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
  duplicate: (id, data) => api.post(`/workboards/${id}/duplicate`, data),
  getStats: (id) => api.get(`/workboards/${id}/stats`),
  getLoraModels: (id) => api.get(`/workboards/${id}/lora-models`),
  refreshLoraModels: (id) => api.post(`/workboards/${id}/lora-models/refresh`),
};

export const jobAPI = {
  create: (data) => api.post('/jobs/generate', data),
  getMy: (params) => api.get('/jobs/my', { params }),
  getById: (id) => api.get(`/jobs/${id}`),
  delete: (id) => api.delete(`/jobs/${id}`),
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
};

export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  approveUser: (id) => api.post(`/admin/users/${id}/approve`),
  rejectUser: (id) => api.post(`/admin/users/${id}/reject`),
  getStats: () => api.get('/admin/stats'),
  getJobs: (params) => api.get('/admin/jobs', { params }),
};

export default api;