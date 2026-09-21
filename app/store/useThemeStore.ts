import { create } from "zustand";

// Тема CRM: светлая (по умолчанию) или тёмная. Выбор помнится в браузере; класс "dark" ставится на <html> только внутри CRM
// (стили — app/[locale]/styles/crm-dark.css, генерируются скриптом scripts/gen-dark-css.js).
export type Theme = "light" | "dark";
const KEY = "crm.theme";

const apply = (t: Theme) => document.documentElement.classList.toggle("dark", t === "dark");

interface ThemeStore {
    theme: Theme;
    init: () => void;
    toggle: () => void;
    release: () => void; // при выходе из CRM (например, на сайт) убираем тёмный класс
}

export const useThemeStore = create<ThemeStore>()((set, get) => ({
    theme: "light",
    init: () => {
        let saved: string | null = null;
        try { saved = localStorage.getItem(KEY); } catch { /* приватный режим */ }
        const theme: Theme = saved === "dark" ? "dark" : "light";
        apply(theme);
        set({ theme });
    },
    toggle: () => {
        const theme: Theme = get().theme === "dark" ? "light" : "dark";
        apply(theme);
        try { localStorage.setItem(KEY, theme); } catch { /* приватный режим */ }
        set({ theme });
    },
    release: () => document.documentElement.classList.remove("dark"),
}));
