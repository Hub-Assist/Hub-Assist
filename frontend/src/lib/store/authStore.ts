import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { User, UserSettings } from '@/types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** 
   * @deprecated use accessToken
   * Kept as a compatibility shim for legacy portions of the codebase to prevent runtime breakages.
   */
  token: string | null;
  /** 
   * Extra additions beyond the core required auth shape.
   * Kept for user preferences and settings integration.
   */
  settings: UserSettings | null;
}

interface AuthActions {
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setSettings: (settings: UserSettings) => void;
  updateUser: (updates: Partial<User>) => void;
  clear: () => void;
  clearAuth: () => void;
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
        token: null,
        isAuthenticated: false,
        isLoading: false,
        settings: null,

        setToken: (token) => set({ accessToken: token, token, isAuthenticated: true }),
        setUser: (user) => set({ user }),
        setSettings: (settings) => set({ settings }),
        updateUser: (updates) => {
          const currentUser = get().user;
          if (currentUser) set({ user: { ...currentUser, ...updates } });
        },

        clearAuth: () =>
          set({ user: null, accessToken: null, token: null, isAuthenticated: false }),
        clear: () => get().clearAuth(),

        initializeAuth: () => {
          const { accessToken } = get();
          if (accessToken && !isTokenExpired(accessToken)) {
            if (typeof document !== 'undefined') {
              document.cookie = `token=${accessToken}; path=/; SameSite=Lax`;
            }
            set({ isAuthenticated: true });
          } else {
            if (typeof document !== 'undefined') {
              document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            }
            get().clearAuth();
          }
        },

        login: ({ access_token, user }) => {
          if (typeof document !== 'undefined') {
            document.cookie = `token=${access_token}; path=/; SameSite=Lax`;
          }
          set({
            accessToken: access_token,
            token: access_token,
            isAuthenticated: true,
            ...(user ? { user } : {}),
          });
        },

        register: ({ access_token, user }) => {
          if (typeof document !== 'undefined') {
            document.cookie = `token=${access_token}; path=/; SameSite=Lax`;
          }
          set({
            accessToken: access_token,
            token: access_token,
            isAuthenticated: true,
            ...(user ? { user } : {}),
          });
        },

        logout: () => {
          if (typeof document !== 'undefined') {
            document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          }
          get().clearAuth();
          if (typeof window !== 'undefined') window.location.href = '/login';
        },

        refreshAccessToken: async () => {
          set({ isLoading: true });
          try {
            const { default: apiClient } = await import('@/lib/apiClient');
            const { data } = await apiClient.post<{ access_token: string }>('/auth/refresh');
            set({ accessToken: data.access_token, token: data.access_token, isAuthenticated: true });
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
