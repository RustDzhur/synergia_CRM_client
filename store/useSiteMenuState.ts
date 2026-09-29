import { create } from "zustand";

// Мобильное меню публичного сайта (лендинг). Отдельное хранилище от useToggleMenuState (боковая панель CRM):
// у CRM панель по умолчанию развёрнута (menu: true), а у сайта меню при загрузке обязано быть закрыто.
interface SiteMenu {
	menu: boolean;
	toggleMenu: () => void;
}

export const useSiteMenuState = create<SiteMenu>()((set) => ({
	menu: false,
	toggleMenu: () => set((state) => ({ menu: !state.menu })),
}));
