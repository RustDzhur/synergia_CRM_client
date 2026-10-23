// Публичный приём заявок с лендингов: нормализация супермножества полей обоих лендингов
// (burokratie-copilot: processDescription, automatisation: message) в один LandingLead,
// валидация и ключ дедупликации. Чистые функции без БД — юнит-тесты не поднимают Prisma.

export const LIMITS = {
    name: 200,
    company: 200,
    email: 254,
    phone: 64,
    text: 4000,
    mandantCount: 80,
    belegVolume: 80,
    datevWorkflow: 120,
    contactChannel: 40,
    companySize: 100,
    industry: 100,
    software: 200,
    preferredContact: 40,
    requestType: 40,
    sourcePage: 200,
    id: 100,
    receivedAt: 100,
    utm: 200,
} as const;

// Мягкая проверка формы адреса: строгая (RFC) отклоняет реальные адреса, а здесь важнее поймать мусор.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export interface LandingLead {
    name: string;
    company: string;
    email: string;
    phone: string;
    // текст заявки: message (automatisation) или processDescription (burokratie)
    text: string;
    textField: "message" | "processDescription";
    mandantCount: string;
    belegVolume: string;
    datevWorkflow: string;
    contactChannel: string;
    companySize: string;
    industry: string;
    software: string;
    preferredContact: string;
    requestType: "" | "demo" | "process_analysis";
    sourcePage: string;
    id: string;
    receivedAt: string;
    marketingConsent: boolean;
    consent: boolean;
    utm: { source: string; medium: string; campaign: string; term: string; content: string; gclid: string };
}

export type LandingErrors = Record<string, string>;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// utm приходит в двух видах: burokratie шлёт {source, medium, …}, automatisation — {utm_source, utm_medium, …}
// (ключ gclid совпадает). Нормализуем в один объект.
export function normalizeUtm(v: unknown): LandingLead["utm"] {
    const src = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    const one = (key: string) => str(src[key], LIMITS.utm);
    return {
        source: one("utm_source") || one("source"),
        medium: one("utm_medium") || one("medium"),
        campaign: one("utm_campaign") || one("campaign"),
        term: one("utm_term") || one("term"),
        content: one("utm_content") || one("content"),
        gclid: one("gclid"),
    };
}

// Нормализует тело запроса и проверяет обязательные поля: name ≥ 2, корректная почта,
// текст (message или processDescription) ≥ 10 символов. Всё лишнее обрезается по лимитам
// лендингов. Невалидная заявка → { errors } с ключами полей формы.
export function parseLandingLead(
    body: unknown
): { lead: LandingLead; errors?: never } | { lead?: never; errors: LandingErrors } {
    const src = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    // текст заявки — message (automatisation) или processDescription (burokratie); если оба пустые,
    // ошибка показывается на message (поле по умолчанию)
    const m = typeof src.message === "string" ? src.message : "";
    const p = typeof src.processDescription === "string" ? src.processDescription : "";
    const useMessage = Boolean(m.trim()) || !p.trim();
    const textField: "message" | "processDescription" = useMessage ? "message" : "processDescription";
    const requestType = str(src.requestType, LIMITS.requestType);
    const lead: LandingLead = {
        name: str(src.name, LIMITS.name),
        company: str(src.company, LIMITS.company),
        email: str(src.email, LIMITS.email).toLowerCase(),
        phone: str(src.phone, LIMITS.phone),
        text: (useMessage ? m : p).trim().slice(0, LIMITS.text),
        textField,
        mandantCount: str(src.mandantCount, LIMITS.mandantCount),
        belegVolume: str(src.belegVolume, LIMITS.belegVolume),
        datevWorkflow: str(src.datevWorkflow, LIMITS.datevWorkflow),
        contactChannel: str(src.contactChannel, LIMITS.contactChannel),
        companySize: str(src.companySize, LIMITS.companySize),
        industry: str(src.industry, LIMITS.industry),
        software: str(src.software, LIMITS.software),
        preferredContact: str(src.preferredContact, LIMITS.preferredContact),
        requestType: requestType === "demo" || requestType === "process_analysis" ? requestType : "",
        sourcePage: str(src.sourcePage, LIMITS.sourcePage),
        id: str(src.id, LIMITS.id),
        receivedAt: str(src.receivedAt, LIMITS.receivedAt),
        marketingConsent: src.marketingConsent === true,
        consent: src.consent === true,
        utm: normalizeUtm(src.utm),
    };
    const errors: LandingErrors = {};
    if (lead.name.length < 2) errors.name = "Name must be at least 2 characters";
    if (!EMAIL_PATTERN.test(lead.email)) errors.email = "Invalid email";
    if (lead.text.length < 10) errors[textField] = "Message must be at least 10 characters";
    return Object.keys(errors).length ? { errors } : { lead };
}

// Ключ дедупликации сделки: externalId = "<site>:<id запроса>" — повторная отправка того же id
// с лендинга не создаёт дублей.
export const landingExternalId = (site: string, id: string) => `${site}:${id}`;

// Метка сайта формы: латиница и цифры с дефисами/подчёркиванием, 2–31 символ, начинается с буквы
// или цифры. «copilot» и «automatisation» — частный случай: метки лендингов фирмы, заданные
// seed-скриптом; остальные фирма заводит сама (Settings → Integration → «Формы с сайтов»).
export const SITE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,30}$/i;

// Сайт, с которого пришла заявка, — из config.site интеграции «landing». Метка приводится
// к нижнему регистру; неизвестная или невалидная → "" (интеграция не настроена).
export function landingSite(config: unknown): string {
    const site = config && typeof config === "object" ? (config as Record<string, unknown>).site : undefined;
    return typeof site === "string" && SITE_PATTERN.test(site) ? site.toLowerCase() : "";
}
