import {create} from "zustand";

interface User {
  id: number;
  name: string;
  imageUrl: string;
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
    try {
      const response = await fetch("https://synergia-crm-server.onrender.com/api/currentUser"); // Replace with the actual server endpoint
      const userData: User = await response.json();
      set({ user: userData, isLoading: false });
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  },
}));
