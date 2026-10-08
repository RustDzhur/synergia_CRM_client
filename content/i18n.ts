// Тексты страниц лендинга на трёх языках лежат рядом с данными: t("English", "Deutsch", "Українська").
export type Lang = "en" | "de" | "ua";
export type Tx = Record<Lang, string>;
export const t3 = (en: string, de: string, ua: string): Tx => ({ en, de, ua });
import { UZ } from "./uz";
// Узбекский: перевод ищется по английскому тексту (content/uz.ts); нет перевода — английский
export const tx = (v: Tx, locale: string): string => (locale === "uz" ? UZ[v.en] ?? v.en : v[(locale as Lang) in v ? (locale as Lang) : "en"]);
