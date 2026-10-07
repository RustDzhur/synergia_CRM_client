// Правила полей регистрации и входа — одни и те же на форме (подсказка сразу под полем) и на сервере (последняя проверка).
// Правило возвращает код; текст на языке человека подбирает форма (authForms.v_<код>), поэтому здесь нет строк для показа.
export type RuleCode =
    | "required" | "name_short" | "name_chars" | "name_long"
    | "email_format" | "email_typo"
    | "password_short" | "password_weak" | "password_long"
    | "phone_format" | "tax_format" | "address_long";
export interface RuleResult { code: RuleCode; params?: Record<string, string | number> }

const EMAIL_RE = /^[^\s@,;:<>()[\]\\"]+@[A-Za-z0-9À-￿](?:[A-Za-z0-9À-￿-]*[A-Za-z0-9À-￿])?(?:\.[A-Za-z0-9À-￿](?:[A-Za-z0-9À-￿-]*[A-Za-z0-9À-￿])?)*\.[A-Za-zÀ-￿]{2,}$/;
// частые опечатки в почтовых доменах: подсказываем, как правильно
const TYPOS: Record<string, string> = {
    "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gamil.com": "gmail.com", "gmail.con": "gmail.com", "gmail.co": "gmail.com", "gmaill.com": "gmail.com", "gnail.com": "gmail.com",
    "yaho.com": "yahoo.com", "yahho.com": "yahoo.com", "yahoo.con": "yahoo.com", "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com", "outlok.com": "outlook.com", "outlook.con": "outlook.com",
    "icloud.con": "icloud.com", "web.con": "web.de", "gmx.con": "gmx.de", "ukr.nt": "ukr.net", "ukt.net": "ukr.net",
};

export function checkEmail(raw: unknown): RuleResult | null {
    const v = String(raw ?? "").trim();
    if (!v) return { code: "required" };
    if (v.length > 200 || v.includes("..") || !EMAIL_RE.test(v)) return { code: "email_format" };
    const typo = TYPOS[v.split("@")[1].toLowerCase()];
    return typo ? { code: "email_typo", params: { suggestion: `${v.split("@")[0]}@${typo}` } } : null;
}

// Имя человека или название фирмы: буквы любого алфавита, цифры, пробел и . , ' ’ & - ( ) /
export function checkName(raw: unknown): RuleResult | null {
    const v = String(raw ?? "").trim();
    if (!v) return { code: "required" };
    if (v.length < 2) return { code: "name_short", params: { min: 2 } };
    if (v.length > 80) return { code: "name_long", params: { max: 80 } };
    if (!/^[\p{L}\p{N}][\p{L}\p{N} .,'’&\-()/]*$/u.test(v)) return { code: "name_chars" };
    return null;
}

// Пароль: от 8 символов, хотя бы одна буква и одна цифра; bcrypt учитывает только первые 72 байта, поэтому длиннее не принимаем
export function checkPassword(raw: unknown): RuleResult | null {
    const v = String(raw ?? "");
    if (!v) return { code: "required" };
    if (v.length < 8) return { code: "password_short", params: { min: 8 } };
    if (Buffer.byteLength(v, "utf8") > 72) return { code: "password_long", params: { max: 72 } };
    if (!/\p{L}/u.test(v) || !/\d/.test(v)) return { code: "password_weak" };
    return null;
}

// Телефон необязателен: если указан — только цифры, + ( ) - . / и пробелы, 6–15 цифр
export function checkPhone(raw: unknown): RuleResult | null {
    const v = String(raw ?? "").trim();
    if (!v) return null;
    const digits = v.replace(/\D/g, "").length;
    if (!/^[+\d\s()\-./]+$/.test(v) || digits < 6 || digits > 15) return { code: "phone_format" };
    return null;
}

// Налоговый номер необязателен: 4–30 букв, цифр, пробелов, - . /
export function checkTax(raw: unknown): RuleResult | null {
    const v = String(raw ?? "").trim();
    if (!v) return null;
    return /^[A-Za-z0-9\s\-./]{4,30}$/.test(v) ? null : { code: "tax_format" };
}

export function checkAddress(raw: unknown): RuleResult | null {
    return String(raw ?? "").trim().length > 200 ? { code: "address_long", params: { max: 200 } } : null;
}
