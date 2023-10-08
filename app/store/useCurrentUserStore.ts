import { create } from "zustand";

interface User {
  id: number;
  firstname: string;
  lasttname: string;
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
    try {
      // Retrieve the user's token from wherever you have stored it (e.g., localStorage)
      const userToken = localStorage.getItem("token");

      if (!userToken) {
        // Handle the case where the token is not available
        console.error("User token not found.");
        return;
      }

      const response = await fetch("https://synergia-crm-server.onrender.com/api/currentUser", {
        headers: {
          Authorization: `Bearer ${userToken}`, // Include the token in the Authorization header
        },
      });

      if (!response.ok) {
        // Handle server error or unauthorized access
        console.error("Error fetching user data:", response.status, response.statusText);
        return;
      }

      const userData: User = await response.json();
      set({ user: userData, isLoading: false });
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  },
}));
