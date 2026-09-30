import { z } from "zod";

// Валидаторы украинских реквизитов — один набор для клиента и сервера (ТЗ §6, §15).
//
// Функции возвращают не текст, а **код** ошибки: тексты живут в messages/{de,en,ua}.json под ключами
// uaErr_*, поэтому один и тот же валидатор годится и для подсказки под полем в браузере, и для отказа
// сервера — без русских строк прямо в коде (требование R6). Пустое значение — не ошибка:
// реквизиты необязательны, пока фирма их не заполнит.

const digits = (v: string) => v.replace(/\s/g, "");

// ЄДРПОУ — 8 цифр (код юрлица в ЕГРПОУ)
export const edrpouSchema = z.string().regex(/^\d{8}$/, "edrpou");
// ІПН/РНОКПП — 10 цифр (внутренний) или 12 (международный формат)
export const ipnSchema = z.string().regex(/^(\d{10}|\d{12})$/, "ipn");
// МФО — 6 цифр
export const mfoSchema = z.string().regex(/^\d{6}$/, "mfo");
// Свідоцтво/витяг платника ПДВ — номер из 5–12 цифр (в разных выписках бывает и с буквами, поэтому цифры)
export const vatCertificateSchema = z.string().regex(/^\d{5,12}$/, "vatcert");
// КВЕД — «62.01» или пять цифр подряд
export const kvedSchema = z.string().regex(/^(\d{2}\.\d{2}|\d{5})$/, "kved");

// IBAN (Украина): «UA» + 27 знаков, контрольная сумма mod-97 = 1 — как в банковском стандарте
export function validIban(value: string): boolean {
    const s = digits(value).toUpperCase();
    if (!/^UA\d{27}$/.test(s)) return false;
    const moved = s.slice(4) + s.slice(0, 4);
    let rest = 0;
    for (const ch of moved) {
        const val = ch >= "0" && ch <= "9" ? Number(ch) : ch.charCodeAt(0) - 55; // A→10 … Z→35
        rest = (rest * (val > 9 ? 100 : 10) + val) % 97;
    }
    return rest === 1;
}
export const ibanUaSchema = z.string().transform((v) => digits(v).toUpperCase()).refine(validIban, "iban");

export type UaFieldCode = "edrpou" | "ipn" | "mfo" | "vatcert" | "kved" | "iban";

const simple: Array<{ field: string; code: UaFieldCode; schema: z.ZodTypeAny }> = [
    { field: "uaEdrpou", code: "edrpou", schema: edrpouSchema },
    { field: "uaIpn", code: "ipn", schema: ipnSchema },
    { field: "uaMfo", code: "mfo", schema: mfoSchema },
    { field: "uaVatCertificate", code: "vatcert", schema: vatCertificateSchema },
    { field: "uaIban", code: "iban", schema: ibanUaSchema },
];

/** Проверка поля по имени: пусто — ок; иначе код ошибки или null. */
export function uaFieldError(field: string, value: unknown): UaFieldCode | null {
    const v = String(value ?? "").trim();
    if (!v) return null;
    if (field === "uaIban") return validIban(v) ? null : "iban";
    if (field === "uaKved") {
        // КВЕД приходит строкой «62.01, 63.11» или массивом — проверяем каждый
        const list = v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
        return list.every((x) => kvedSchema.safeParse(x).success) ? null : "kved";
    }
    const def = simple.find((s) => s.field === field);
    if (!def) return null;
    return def.schema.safeParse(v).success ? null : def.code;
}

/** Ошибки профиля: [{ field, code }] — интерфейс показывает их под полями, сервер отклоняет PATCH. */
export function uaProfileErrors(input: Record<string, unknown>): Array<{ field: string; code: UaFieldCode }> {
    const out: Array<{ field: string; code: UaFieldCode }> = [];
    for (const { field, code } of simple) {
        if (input[field] !== undefined && uaFieldError(field, input[field]) === code) out.push({ field, code });
    }
    if (input.uaKved !== undefined && uaFieldError("uaKved", input.uaKved) === "kved") out.push({ field: "uaKved", code: "kved" });
    return out;
}

// ── Система налогообложения ─────────────────────────────────────────────────────────────────────────
// Формы: ФОП и ТОВ (ПП/ПрАТ — тоже юрособа). ФОП: единый налог групп 1–4 или общая система;
// ТОВ: общая (податок на прибуток) или единый налог юрособы (3-я группа).

export const UA_TAX_SYSTEMS = ["single_1", "single_2", "single_3", "single_4", "general_fop", "general_tov", "single_tov"] as const;
export type UaTaxSystem = (typeof UA_TAX_SYSTEMS)[number];

export function taxSystemOf(settings: { uaTaxSystem?: string; uaLegalForm?: string; uaGroup?: unknown }): UaTaxSystem {
    const raw = String(settings.uaTaxSystem ?? "");
    if ((UA_TAX_SYSTEMS as readonly string[]).includes(raw)) return raw as UaTaxSystem;
    // Старые фирмы хранят только форму и группу — выводим систему из них
    const tov = settings.uaLegalForm === "tov" || settings.uaLegalForm === "other";
    const group = Number(settings.uaGroup);
    if (tov) return group === 3 ? "single_tov" : "general_tov";
    if ([1, 2, 3, 4].includes(group)) return `single_${group}` as UaTaxSystem;
    return "general_fop";
}

/** Пара «форма + группа» для системы — их ждут отчёты (uaProfile) и настройки. */
export function formAndGroup(system: UaTaxSystem, singleRate = 5): { legalForm: "fop" | "tov"; group: number; labelRate: number } {
    if (system === "general_tov") return { legalForm: "tov", group: 0, labelRate: singleRate };
    if (system === "single_tov") return { legalForm: "tov", group: 3, labelRate: singleRate };
    if (system === "general_fop") return { legalForm: "fop", group: 0, labelRate: singleRate };
    const group = Number(system.replace("single_", ""));
    return { legalForm: "fop", group, labelRate: singleRate };
}

/** Все ли системы допустимы для формы: ФОП не может быть на «податку на прибуток», ТОВ — в 1-й группе. */
export function taxSystemsFor(legalForm: string): UaTaxSystem[] {
    return legalForm === "tov" || legalForm === "other" ? ["general_tov", "single_tov"] : ["single_1", "single_2", "single_3", "single_4", "general_fop"];
}
