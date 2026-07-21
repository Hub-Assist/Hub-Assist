import axios from 'axios';
import { env } from '@/utils/env';

const apiClient = axios.create({
  baseURL: env.apiUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Lazily resolved store reference to avoid circular dependency
let _getState: (() => { accessToken: string | null; refreshAccessToken: () => Promise<void>; logout: () => void }) | null = null;

async function getStore() {
  if (!_getState) {
    const { useAuthStore } = await import('@/lib/store/authStore');
    _getState = useAuthStore.getState;
  }
  return _getState();
}

// Request interceptor — attach Bearer token
apiClient.interceptors.request.use(async (config) => {
  const store = await getStore();
  if (store.accessToken) config.headers.Authorization = `Bearer ${store.accessToken}`;
  return config;
});

// Response interceptor — unwrap { success, data, timestamp } envelope + handle 401 with one refresh retry
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => {
    // Unwrap the { success, data, timestamp } envelope when present
    if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
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
        refreshQueue.push(() => reject(error));
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const store = await getStore();
      await store.refreshAccessToken();
      const { accessToken } = await getStore();
      if (!accessToken) throw new Error('No token after refresh');

      original.headers.Authorization = `Bearer ${accessToken}`;
      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];
      return apiClient(original);
    } catch {
      refreshQueue = [];
      const store = await getStore();
      store.logout();
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

// Types
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  workspaceName: string;
  memberName?: string;
  date: string;
  startTime: string;
  endTime: string;
  amount: number;
  status: BookingStatus;
}

export interface AttendanceRecord {
  id: string;
  userId?: string;
  memberName?: string;
  clockIn: string;
  clockOut?: string;
  date: string;
}

// API functions
export const api = {
  login: (email: string, password: string) =>
    post<{ access_token: string }>('/auth/login', { email, password }),

  register: (data: { firstname: string; lastname: string; email: string; password: string }) =>
    post<{ message: string }>('/auth/register', data),

  forgotPassword: (email: string) =>
    post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    post<{ message: string }>('/auth/reset-password', { email, otp, newPassword }),

  verifyOtp: (email: string, otp: string) =>
    post<{ access_token: string; refresh_token: string }>('/auth/verify-otp', { email, otp }),

  resendOtp: (email: string) =>
    post<{ message: string }>('/auth/resend-otp', { email }),

  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string }) =>
    get<{ users: import('@/types/user').User[]; total: number; page: number; totalPages: number }>('/users', { params }),

  updateUser: (userId: string, data: { firstname?: string; lastname?: string; stellarPublicKey?: string }) =>
    patch<{ message: string }>(`/users/${userId}`, data),

  updateUserRole: (userId: string, role: string) =>
    patch<{ message: string }>(`/users/${userId}/role`, { role }),

  deactivateUser: (userId: string) =>
    patch<{ message: string }>(`/users/${userId}/deactivate`),

  activateUser: (userId: string) =>
    patch<{ message: string }>(`/users/${userId}/activate`),

  deleteUser: (userId: string) =>
    del<{ message: string }>(`/users/${userId}`),

  uploadProfilePicture: async (userId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return post<{ avatarUrl: string }>(`/users/${userId}/profile-picture`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    post<{ message: string }>('/users/change-password', data),

  getWorkspaces: (params?: { type?: string; availability?: boolean; minPrice?: number; maxPrice?: number }) =>
    get<{ workspaces: import('@/types/workspace').Workspace[] }>('/workspaces', { params }),

  getWorkspace: (workspaceId: string) =>
    get<{ workspace: import('@/types/workspace').Workspace }>(`/workspaces/${workspaceId}`),

  createBooking: (data: { workspaceId: string; startTime: string; endTime: string }) =>
    post<{ booking: Booking; message: string }>('/bookings', data),

  getBookings: (status?: string) =>
    get<Booking[]>(`/bookings${status ? `?status=${status}` : ''}`),

  getBooking: (id: string) =>
    get<Booking>(`/bookings/${id}`),

  confirmBooking: (id: string) =>
    patch<Booking>(`/bookings/${id}/confirm`),

  cancelBooking: (id: string) =>
    patch<Booking>(`/bookings/${id}/cancel`),

  getAttendance: (date?: string) =>
    get<AttendanceRecord[]>(`/attendance${date ? `?date=${date}` : ''}`),

  clockIn: () =>
    post<AttendanceRecord>('/attendance/clock-in'),

  clockOut: () =>
    post<AttendanceRecord>('/attendance/clock-out'),

  getDashboardStats: () =>
    get<{
      totalMembers: number;
      verifiedMembers: number;
      activeWorkspaces: number;
      deskOccupancy: number;
      pendingBookings?: number;
      revenueThisMonth?: number;
    }>('/dashboard/stats'),

  getDashboardActivity: () =>
    get<Array<{ id: string; icon: string; description: string; timestamp: string }>>('/dashboard/activity'),

  getDashboardGrowth: () =>
    get<Array<{ date: string; members: number }>>('/dashboard/growth'),

  getAnalyticsMemberGrowth: (period: '7d' | '30d' | '90d' = '30d') =>
    get<Array<{ date: string; count: number }>>(`/analytics/member-growth?period=${period}`),

  getAnalyticsBookingRevenue: (period: '7d' | '30d' | '90d' = '30d') =>
    get<Array<{ date: string; revenue: number }>>(`/analytics/booking-revenue?period=${period}`),

  getAnalyticsWorkspaceUtilization: () =>
    get<Array<{ workspaceId: string; name: string; utilizationPct: number }>>('/analytics/workspace-utilization'),

  getAnalyticsAttendancePatterns: () =>
    get<{ peakHours: Array<{ hour: number; count: number }>; dayOfWeekPatterns: Array<{ day: string; count: number }> }>('/analytics/attendance-patterns'),

  verifyStellarTx: (txHash: string) =>
    post<{ status: string; [key: string]: unknown }>('/stellar/verify-tx', { txHash }),

  issueMembershipToken: (data: { userId: string; tier: number; expiryDate: string }) =>
    post<{ tokenId: string; message: string }>('/membership-tokens', data),
};
