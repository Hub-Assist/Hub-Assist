import axios from 'axios';
import { env } from '@/utils/env';

const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach Bearer token
apiClient.interceptors.request.use((config) => {
  const { accessToken } = require('@/lib/store/authStore').useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Response interceptor — handle 401 with one refresh retry
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
        // If refresh ultimately fails, reject queued requests
        refreshQueue.push(() => reject(error));
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const store = require('@/lib/store/authStore').useAuthStore.getState();
      await store.refreshAccessToken();
      const { accessToken } = require('@/lib/store/authStore').useAuthStore.getState();
      if (!accessToken) throw new Error('No token after refresh');

      original.headers.Authorization = `Bearer ${accessToken}`;
      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];
      return apiClient(original);
    } catch {
      refreshQueue = [];
      require('@/lib/store/authStore').useAuthStore.getState().logout();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;

export const get = <T>(url: string, config?: Parameters<typeof apiClient.get>[1]) =>
  apiClient.get<T>(url, config).then((r) => r.data);

export const post = <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.post>[2]) =>
  apiClient.post<T>(url, data, config).then((r) => r.data);

export const patch = <T>(url: string, data?: unknown, config?: Parameters<typeof apiClient.patch>[2]) =>
  apiClient.patch<T>(url, data, config).then((r) => r.data);

export const del = <T>(url: string, config?: Parameters<typeof apiClient.delete>[1]) =>
  apiClient.delete<T>(url, config).then((r) => r.data);
