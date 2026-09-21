// Тексты страниц лендинга на трёх языках лежат рядом с данными: t("English", "Deutsch", "Українська").
export type Lang = "en" | "de" | "ua";
export type Tx = Record<Lang, string>;
export const t3 = (en: string, de: string, ua: string): Tx => ({ en, de, ua });
export const tx = (v: Tx, locale: string): string => v[(locale as Lang) in v ? (locale as Lang) : "en"];
