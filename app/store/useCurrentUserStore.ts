import { create } from "zustand";
import useAuthStore from "./useAuthStore";

export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  avatarUrl: string;
  phone: string;
  position: string;
  city: string;
  country: string;
}

export type UserUpdate = Partial<Omit<User, "id" | "email">>;

interface CurrentUserStore {
  user: User | null;
  isLoading: boolean;
  isDropDown: boolean;
  isProfileOpen: boolean;
  toggleDropDown: () => void;
  closeDropDown: () => void;
  openProfile: () => void;
  closeProfile: () => void;
  fetchUser: () => Promise<void>;
  updateUser: (data: UserUpdate) => Promise<boolean>;
}

// Компонент CurrentUser рендерится в шапке и в мобильном меню одновременно —
// без этого каждый экземпляр слал бы свой запрос /api/auth/me.
let inflight: Promise<void> | null = null;

export const useCurrentUserStore = create<CurrentUserStore>((set) => ({
  user: null,
  isLoading: true,
  isDropDown: false,
  isProfileOpen: false,
  toggleDropDown: () => set((state) => ({ isDropDown: !state.isDropDown })),
  closeDropDown: () => set({ isDropDown: false }),
  openProfile: () => set({ isProfileOpen: true, isDropDown: false }),
  closeProfile: () => set({ isProfileOpen: false }),
  fetchUser: () => {
    if (inflight) return inflight;
    inflight = (async () => {
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
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  },
  updateUser: async (data) => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) return false;
      set({ user: await response.json() });
      return true;
    } catch (error) {
      console.error("Error updating user:", error);
      return false;
    }
  },
}));
