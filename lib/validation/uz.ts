// Валидаторы реквизитов Узбекистана. Как и украинские (lib/validation/ua.ts), возвращают КОД ошибки, а не текст:
// тексты — в messages/*.json под ключами uzErr_*. Пустое значение — не ошибка: реквизиты необязательны, пока фирма их не заполнит.
//
// Что проверяем строго, а что нет:
//  • ПИНФЛ — 14 цифр, МФО банка — 5 цифр, расчётный счёт — 20 цифр: форматы устойчивые, ошибка в них почти всегда опечатка;
//  • ИНН (STIR) — только цифры, длина 9–14: источники подтверждают, что ИНН у юрлиц сохраняется, но точную длину не подтвердили
//    (docs/TZ_UZBEKISTAN_AND_ROBOTS.md, M-2), поэтому в интерфейсе остаётся пометка «формат не проверен специалистом».
const digits = (v: string) => v.replace(/[\s-]/g, "");

export type UzFieldCode = "inn" | "pinfl" | "mfo" | "account" | "vatcode" | "date";

export const UZ_FIELDS = ["inn", "pinfl", "vatCode", "bank", "mfo", "account", "director", "accountant", "oked", "taxRegime", "vatPayer", "vatRegDate", "esfOperator"] as const;
export const UZ_TAX_REGIMES = ["general", "simplified_vat6", "turnover", "self_employed"] as const;
export type UzTaxRegime = (typeof UZ_TAX_REGIMES)[number];

export interface UzProfile {
    inn: string; pinfl: string; vatCode: string; bank: string; mfo: string; account: string; director: string; accountant: string; oked: string;
    taxRegime: UzTaxRegime | ""; vatPayer: boolean; vatRegDate: string; esfOperator: string;
}

export const emptyUz = (): UzProfile => ({ inn: "", pinfl: "", vatCode: "", bank: "", mfo: "", account: "", director: "", accountant: "", oked: "", taxRegime: "", vatPayer: false, vatRegDate: "", esfOperator: "" });

export function uzFieldError(field: string, value: unknown): UzFieldCode | null {
    const v = String(value ?? "").trim();
    if (!v) return null;
    const d = digits(v);
    switch (field) {
        case "inn": return /^\d{9,14}$/.test(d) ? null : "inn";
        case "pinfl": return /^\d{14}$/.test(d) ? null : "pinfl";
        case "mfo": return /^\d{5}$/.test(d) ? null : "mfo";
        case "account": return /^\d{20}$/.test(d) ? null : "account";
        case "vatCode": return /^\d{9,14}$/.test(d) ? null : "vatcode";
        case "vatRegDate": return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : "date";
        default: return null;
    }
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Приводит присланный объект к профилю: неизвестные поля отбрасываются, цифровые — очищаются от пробелов. Поля с ошибкой формата остаются прежними (cur). */
export function mergeUz(cur: Partial<UzProfile> | null | undefined, input: unknown): { value: UzProfile; errors: { field: string; code: UzFieldCode }[] } {
    const base = { ...emptyUz(), ...(cur ?? {}) };
    const errors: { field: string; code: UzFieldCode }[] = [];
    if (!input || typeof input !== "object") return { value: base, errors };
    const b = input as Record<string, unknown>;
    for (const k of ["inn", "pinfl", "vatCode", "mfo", "account"] as const) {
        if (b[k] === undefined) continue;
        const raw = text(b[k], 40);
        const code = uzFieldError(k, raw);
        if (code) errors.push({ field: k, code });
        else base[k] = digits(raw);
    }
    if (b.vatRegDate !== undefined) {
        const raw = text(b.vatRegDate, 10);
        const code = uzFieldError("vatRegDate", raw);
        if (code) errors.push({ field: "vatRegDate", code });
        else base.vatRegDate = raw;
    }
    for (const [k, max] of [["bank", 120], ["director", 120], ["accountant", 120], ["oked", 60], ["esfOperator", 60]] as const) if (b[k] !== undefined) base[k] = text(b[k], max);
    if (b.taxRegime !== undefined) base.taxRegime = (UZ_TAX_REGIMES as readonly string[]).includes(String(b.taxRegime)) ? (b.taxRegime as UzTaxRegime) : "";
    if (typeof b.vatPayer === "boolean") base.vatPayer = b.vatPayer;
    return { value: base, errors };
}
