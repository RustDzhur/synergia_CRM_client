import type { AbstractIntlMessages } from "next-intl";
import { FULL_LOCALES } from "./locales";

type Dict = { [k: string]: unknown };
const isObj = (v: unknown): v is Dict => !!v && typeof v === "object" && !Array.isArray(v);

/** Поверх запасного словаря кладёт переводы: недостающие ключи остаются на запасном языке, а не показываются как «office.tpl_x». */
export function mergeMessages(base: Dict, over: Dict): Dict {
    const out: Dict = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? mergeMessages(base[k] as Dict, v) : v;
    return out;
}

/** Сообщения интерфейса для языка. Языки без полного перевода (uz) дополняются английским. */
export async function loadMessages(locale: string): Promise<AbstractIntlMessages> {
    const own = (await import(`../messages/${locale}.json`)).default as Dict;
    if ((FULL_LOCALES as readonly string[]).includes(locale)) return own as AbstractIntlMessages;
    const en = (await import("../messages/en.json")).default as Dict;
    return mergeMessages(en, own) as AbstractIntlMessages;
}
