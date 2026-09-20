import { create } from "zustand";
import useAuthStore from "./useAuthStore";
interface User {
  id: string;
  firstname: string;
  lastname: string;
  avatarUrl: string;
}

interface CurrentUserStore {
  user: User | null;
  isLoading: boolean;
  isDropDown: boolean;
  toggleDropDown: () => void;
  fetchUser: () => Promise<void>;
}

export const useCurrentUserStore = create<CurrentUserStore>((set) => ({
  user: null,
  isLoading: true,
  isDropDown: false,
  toggleDropDown: () => set((state) => ({ isDropDown: !state.isDropDown })),
  fetchUser: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ user: null, isLoading: false });
      return;
    }
    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        useAuthStore.getState().logout(); // токен просрочен
        set({ user: null, isLoading: false });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      set({ user: await response.json(), isLoading: false });
    } catch (error) {
      console.error("Error fetching user data:", error);
      set({ user: null, isLoading: false });
    }
  },
}));
