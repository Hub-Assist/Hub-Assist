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

  getUsers: (token: string) =>
    request<unknown[]>('/users', {
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

  // Bookings
  getBookings: (token: string, status?: string) =>
    request<Booking[]>(`/bookings${status ? `?status=${status}` : ''}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  getBooking: (token: string, id: string) =>
    request<Booking>(`/bookings/${id}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  confirmBooking: (token: string, id: string) =>
    request<Booking>(`/bookings/${id}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  cancelBooking: (token: string, id: string) =>
    request<Booking>(`/bookings/${id}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  // Attendance
  getAttendance: (token: string, date?: string) =>
    request<AttendanceRecord[]>(`/attendance${date ? `?date=${date}` : ''}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  clockIn: (token: string) =>
    request<AttendanceRecord>('/attendance/clock-in', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),

  clockOut: (token: string) =>
    request<AttendanceRecord>('/attendance/clock-out', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }),
};

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
