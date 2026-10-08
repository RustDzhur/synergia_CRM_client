// Языки платформы — один список для сервера и клиента. Добавление языка: код сюда, файл messages/<код>.json,
// флаг в languages/languages.ts. Код украинского исторически "ua" (не "uk"); узбекский — "uz", латиница.
export const LOCALES = ["de", "en", "ua", "uz"] as const;
export type Locale = (typeof LOCALES)[number];

/** Языки, в которых есть полный перевод интерфейса. Остальные работают с запасным английским для недостающих ключей. */
export const FULL_LOCALES: readonly Locale[] = ["de", "en", "ua"];

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Приводит присланное значение к поддерживаемому языку, иначе — запасной. */
export const pickLocale = (v: unknown, fallback: Locale = "en"): Locale => (isLocale(v) ? v : fallback);

/** Метка языка для Intl/hreflang (украинский у Intl — uk). */
export const intlTag = (l: string): string => (l === "ua" ? "uk" : l);

/** Язык, для которого есть готовые таблицы текстов (письма, PDF, ответы). uz пока идёт с запасным английским. */
export const isFullLocale = (v: unknown): v is "de" | "en" | "ua" => typeof v === "string" && (FULL_LOCALES as readonly string[]).includes(v);
