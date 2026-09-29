import { create } from "zustand";

// CRM всегда тёмная (почти чёрная + салатовый акцент) — раньше тут был переключатель светлая/тёмная, убрали по просьбе
// пользователя. Класс "dark" ставится на <html> только внутри CRM (стили — app/[locale]/styles/crm-dark.css,
// генерируются scripts/gen-dark-css.js), чтобы маркетинговый сайт (свой отдельный тёмный дизайн) не зависел от этого класса.
interface ThemeStore {
    init: () => void;
    release: () => void; // при выходе из CRM (например, на сайт) убираем класс dark
}

export const useThemeStore = create<ThemeStore>()(() => ({
    init: () => document.documentElement.classList.add("dark"),
    release: () => document.documentElement.classList.remove("dark"),
}));
