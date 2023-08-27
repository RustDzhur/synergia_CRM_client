import { create } from "zustand";

interface ToggleMenu {
	menu: boolean;
	toggleMenu: () => void;
}

export const useToggleMenuState = create<ToggleMenu>()((set) => ({
	menu: false,
	toggleMenu: () => set((state) => ({ menu: !state.menu })),
}));
