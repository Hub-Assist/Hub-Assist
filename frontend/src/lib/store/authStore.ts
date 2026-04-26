import { create } from "zustand/react";
import { User, UserSettings } from "@/types/user";

interface AuthState {
  token: string | null;
  user: User | null;
  settings: UserSettings | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setSettings: (settings: UserSettings) => void;
  updateUser: (updates: Partial<User>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  settings: null,
  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),
  updateUser: (updates) => {
    const currentUser = get().user;
    if (currentUser) {
      set({ user: { ...currentUser, ...updates } });
    }
  },
  clear: () => set({ token: null, user: null, settings: null }),
}));
