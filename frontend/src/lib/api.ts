const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { firstname: string; lastname: string; email: string; password: string }) =>
    request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getUsers: (token: string, params?: { page?: number; limit?: number; search?: string; role?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    const query = queryParams.toString();
    return request<{ users: any[]; total: number; page: number; totalPages: number }>(`/users${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  },

  updateUser: (token: string, userId: string, data: { firstname?: string; lastname?: string; stellarPublicKey?: string }) =>
    request<{ message: string }>(`/users/${userId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  updateUserRole: (token: string, userId: string, role: string) =>
    request<{ message: string }>(`/users/${userId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }),

  deactivateUser: (token: string, userId: string) =>
    request<{ message: string }>(`/users/${userId}/deactivate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  activateUser: (token: string, userId: string) =>
    request<{ message: string }>(`/users/${userId}/activate`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  deleteUser: (token: string, userId: string) =>
    request<{ message: string }>(`/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  uploadProfilePicture: (token: string, userId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${API_BASE}/users/${userId}/profile-picture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    });
  },

  changePassword: (token: string, data: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>(`/users/change-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getWorkspaces: (params?: { type?: string; availability?: boolean; minPrice?: number; maxPrice?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.availability !== undefined) queryParams.append('availability', params.availability.toString());
    if (params?.minPrice) queryParams.append('minPrice', params.minPrice.toString());
    if (params?.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
    const query = queryParams.toString();
    return request<any[]>(`/workspaces${query ? `?${query}` : ''}`);
  },

  getWorkspace: (workspaceId: string) =>
    request<any>(`/workspaces/${workspaceId}`),

  createBooking: (token: string, data: { workspaceId: string; startTime: string; endTime: string }) =>
    request<{ booking: any; message: string }>(`/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getBookings: (token: string) =>
    request<any[]>(`/bookings`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  getDashboardStats: (token: string) =>
    request<{
      totalMembers: number;
      verifiedMembers: number;
      activeWorkspaces: number;
      deskOccupancy: number;
      pendingBookings?: number;
      revenueThisMonth?: number;
    }>('/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  getDashboardActivity: (token: string) =>
    request<Array<{ id: string; icon: string; description: string; timestamp: string }>>(
      '/dashboard/activity',
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    ),

  getDashboardGrowth: (token: string) =>
    request<Array<{ date: string; members: number }>>(
      '/dashboard/growth',
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    ),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    }),

  verifyOtp: (email: string, otp: string) =>
    request<{ access_token: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  resendOtp: (email: string) =>
    request<{ message: string }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};
