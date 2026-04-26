import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type UserRole = 'admin' | 'member' | 'staff';

export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: UserRole;
}
import { create } from "zustand/react";
import { User, UserSettings } from "@/types/user";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  /** @deprecated use clearAuth */
  settings: UserSettings | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setSettings: (settings: UserSettings) => void;
  updateUser: (updates: Partial<User>) => void;
  clear: () => void;
  initializeAuth: () => void;
  login: (data: { access_token: string; user?: User }) => void;
  register: (data: { access_token: string; user?: User }) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  updateProfile: (data: Partial<User>) => void;
}

type AuthStore = AuthState & AuthActions;

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,

        setToken: (token) => set({ accessToken: token, isAuthenticated: true }),
        setUser: (user) => set({ user }),

        clearAuth: () =>
          set({ user: null, accessToken: null, isAuthenticated: false }),
        clear: () => get().clearAuth(),

        initializeAuth: () => {
          const { accessToken } = get();
          if (accessToken && !isTokenExpired(accessToken)) {
            set({ isAuthenticated: true });
          } else {
            get().clearAuth();
          }
        },

        login: ({ access_token, user }) =>
          set({
            accessToken: access_token,
            isAuthenticated: true,
            ...(user ? { user } : {}),
          }),

        register: ({ access_token, user }) =>
          set({
            accessToken: access_token,
            isAuthenticated: true,
            ...(user ? { user } : {}),
          }),

        logout: () => {
          get().clearAuth();
          if (typeof window !== 'undefined') window.location.href = '/login';
        },

        refreshAccessToken: async () => {
          set({ isLoading: true });
          try {
            // Imported lazily to avoid circular dependency with apiClient
            const { default: apiClient } = await import('@/lib/apiClient');
            const { data } = await apiClient.post<{ access_token: string }>(
              '/auth/refresh',
            );
            set({ accessToken: data.access_token, isAuthenticated: true });
          } catch {
            get().clearAuth();
          } finally {
            set({ isLoading: false });
          }
        },

        updateProfile: (data) =>
          set((s) => ({ user: s.user ? { ...s.user, ...data } : s.user })),
      }),
      {
        name: 'auth-storage',
        partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
      },
    ),
    { name: 'AuthStore' },
  ),
);

/** Shallow-wrapped selector hook for performance */
export function useAuthState() {
  return useAuthStore(
    useShallow((s) => ({
      user: s.user,
      accessToken: s.accessToken,
      isAuthenticated: s.isAuthenticated,
      isLoading: s.isLoading,
    })),
  );
}
