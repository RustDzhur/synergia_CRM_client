import { create } from "zustand";

interface ToggleMenu {
	menu: boolean;
	mobileMenu: boolean;
	toggleMenu: () => void;
	toggleMobileMenu: () => void;
}

export const useToggleMenuState = create<ToggleMenu>()((set) => ({
	menu: true, // в Figma сайдбар по умолчанию развёрнут
	mobileMenu: false,
	toggleMenu: () => set((state) => ({ menu: !state.menu })),
	toggleMobileMenu: () => set((state) => ({ mobileMenu: !state.mobileMenu })),
}));