import type { Tx } from "../i18n";

// Шаг документации — текст на трёх языках. Названия кнопок, вкладок и полей пишутся как [[пространство.ключ]]
// и подставляются из messages/{язык}.json: подпись в документации всегда совпадает с подписью в кабинете.
export type DocGroup = { title: Tx; steps: Tx[] };
export type DocSection = { id: string; title: Tx; intro?: Tx; groups: DocGroup[] };
