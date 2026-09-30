// Общий слой валидации (ТЗ §15): один набор проверок для клиента и сервера. Каждая функция
// возвращает true/false, а тексты ошибок живут в messages/*.json под ключами valErr_* — поэтому
// и подсказка под полем, и отказ сервера говорят одно и то же, без русских строк в коде.
//
// Проверяем не «похоже ли», а по контрольным правилам там, где они есть:
//   • IBAN — длина по стране и контрольная сумма mod-97;
//   • немецкий USt-IdNr — контрольная цифра по ISO 7064 (MOD 11,10);
//   • BIC/SWIFT, EORI, HRB/HRA, PLZ, украинский поштовий індекс — формат;
//   • номер карты НЕ хранится вовсе (PCI DSS): только токены провайдеров и последние 4 цифры,
//     поэтому валидатора карт здесь нет — и быть не должно.

export type FieldCode =
    | "iban" | "bic" | "vatId" | "taxNumber" | "register" | "postcode" | "eori"
    | "email" | "url" | "phone" | "date" | "amount" | "rate";

// ── IBAN ────────────────────────────────────────────────────────────────────────────────────────────
// Длины IBAN по странам, которые встречаются у наших фирм и клиентов (ISO 13616).
const IBAN_LENGTH: Record<string, number> = {
    DE: 22, AT: 20, CH: 21, NL: 18, BE: 16, FR: 27, IT: 27, ES: 24, PL: 28, CZ: 24, SK: 24,
    LT: 20, LV: 21, EE: 20, SE: 24, FI: 18, DK: 18, NO: 15, IE: 22, PT: 25, LU: 20, GR: 27,
    UA: 29, GB: 22, RO: 24, BG: 22, HU: 28, HR: 21, SI: 19,
};

export const normalizeIbanValue = (v: string) => v.replace(/\s+/g, "").toUpperCase();

/** Контрольная сумма IBAN: буквы → числа, первые четыре знака в конец, mod 97 должно быть 1. */
export function validIbanAny(value: string): boolean {
    const s = normalizeIbanValue(value);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
    const country = s.slice(0, 2);
    const expect = IBAN_LENGTH[country];
    if (expect && s.length !== expect) return false;
    const moved = s.slice(4) + s.slice(0, 4);
    let rest = 0;
    for (const ch of moved) {
        const val = ch >= "0" && ch <= "9" ? Number(ch) : ch.charCodeAt(0) - 55;
        rest = (rest * (val > 9 ? 100 : 10) + val) % 97;
    }
    return rest === 1;
}

export const validBic = (v: string) => /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v.trim().toUpperCase());

// ── Налоговые номера ───────────────────────────────────────────────────────────────────────────────

/** Немецкий USt-IdNr: DE + 9 цифр, девятая — контрольная (ISO 7064 MOD 11,10). */
export function validUstId(value: string): boolean {
    const s = value.trim().toUpperCase().replace(/\s/g, "");
    if (!/^DE\d{9}$/.test(s)) return false;
    const digits = s.slice(2);
    let product = 10;
    for (let i = 0; i < 8; i++) {
        let sum = (Number(digits[i]) + product) % 10;
        if (sum === 0) sum = 10;
        product = (sum * 2) % 11;
    }
    let check = 11 - product;
    if (check === 10) check = 0;
    return check === Number(digits[8]);
}

/** Немецкий Steuernummer: формат зависит от земли, поэтому проверяем только разумный формат. */
export const validSteuernummer = (v: string) => /^\d{2,3}[/ ]?\d{3}[/ ]?\d{4,5}$/.test(v.trim()) || /^\d{10,11}$/.test(v.trim());

/** Регистровый номер: HRB/HRA + до 7 цифр (немецкий торговый реестр). */
export const validRegisterNumber = (v: string) => /^(HRB|HRA|GnR|PR|VR)\s?\d{1,7}$/i.test(v.trim());

/** EORI: код страны + 6–15 знаков (номер экспортёра/импортёра ЕС). */
export const validEori = (v: string) => /^[A-Z]{2}[A-Z0-9]{6,15}$/.test(v.trim().toUpperCase());

/** Почтовые индексы: Германия — 5 цифр (от 01067), Украина — 5 цифр (от 01001). */
export function validPostcode(value: string, country: "DE" | "UA" | string): boolean {
    const s = value.trim();
    if (country === "DE") return /^\d{5}$/.test(s) && Number(s) >= 1067;
    return /^\d{5}$/.test(s);
}

// ── Обычные поля ───────────────────────────────────────────────────────────────────────────────────
// Телефон — без libphonenumber (пакет недоступен): допускаем +, цифры, пробелы, скобки и дефисы,
// от 9 до 15 цифр — этого достаточно, чтобы отсечь мусор, не отвергая чужие форматы.

export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const validUrl = (v: string) => /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v.trim());
export const validPhone = (v: string) => {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 9 && digits.length <= 15 && /^[+\d][\d\s()-]*$/.test(v.trim());
};
export const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && !Number.isNaN(new Date(v).getTime());
export const validAmount = (v: string | number) => Number.isFinite(Number(v)) && Number(v) >= 0;
export const validRate = (v: string | number) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 100;

/** Одна точка входа: код поля → проверка. Пустое значение ошибкой не считается (поле необязательно). */
const CHECKS: Record<FieldCode, (v: string) => boolean> = {
    iban: validIbanAny,
    bic: validBic,
    vatId: (v) => (/^DE/i.test(v.trim()) ? validUstId(v) : /^[A-Z]{2}[A-Z0-9]{5,14}$/.test(v.trim().toUpperCase())),
    taxNumber: validSteuernummer,
    register: validRegisterNumber,
    postcode: (v) => validPostcode(v, "DE"),
    eori: validEori,
    email: validEmail,
    url: validUrl,
    phone: validPhone,
    date: validDate,
    amount: validAmount,
    rate: validRate,
};

export function fieldError(code: FieldCode, value: unknown): FieldCode | null {
    const v = String(value ?? "").trim();
    if (!v) return null;
    return CHECKS[code](v) ? null : code;
}

/** Ошибки набора полей: [{ field, code }] — сервер отвечает ими, интерфейс переводит их сам. */
export function collectErrors(values: Record<string, unknown>, specs: Record<string, FieldCode>): Array<{ field: string; code: FieldCode }> {
    const out: Array<{ field: string; code: FieldCode }> = [];
    for (const [field, code] of Object.entries(specs)) {
        const err = fieldError(code, values[field]);
        if (err) out.push({ field, code: err });
    }
    return out;
}
