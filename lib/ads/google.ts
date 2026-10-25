import { ProviderError, fetchProvider } from "@/lib/http";
import type { AdsAccount, AdsInsights } from "./types";

// Google Ads API (REST). Нужны: OAuth-клиент Google (тот же, что для почты и Drive) с областью adwords и «developer token»
// рекламного менеджерского аккаунта (GOOGLE_ADS_DEVELOPER_TOKEN). Версия API меняется — задаётся GOOGLE_ADS_API_VERSION.
export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
import { platformEnvCached } from "@/lib/platformEnv";

// Явно заданная версия (GOOGLE_ADS_API_VERSION / GOOGLE_ADS_API_URL) — единственная; иначе пробуем
// известные версии от новой к старой: Google снимает версии с поддержки, и устаревшая отвечает 404.
const EXPLICIT_VERSION = () => platformEnvCached("GOOGLE_ADS_API_VERSION");
const EXPLICIT_URL = () => platformEnvCached("GOOGLE_ADS_API_URL");
const VERSIONS = ["v26", "v25", "v24", "v23", "v22", "v20"] as const;
const g = globalThis as { __adsVersion?: { at: number; value: string } };
const VERSION_TTL = 6 * 60 * 60 * 1000;

const baseFor = (version: string) =>
    (EXPLICIT_URL() && EXPLICIT_VERSION() ? EXPLICIT_URL() : EXPLICIT_URL() || `https://googleads.googleapis.com/${version}`).replace(/\/+$/, "");

/** Рабочая версия API: сперва запомнённая, иначе последовательно v26 → v22. */
function versionsToTry(): string[] {
    const explicit = EXPLICIT_VERSION();
    if (explicit) return [explicit];
    const remembered = g.__adsVersion && Date.now() - g.__adsVersion.at < VERSION_TTL ? g.__adsVersion.value : "";
    return remembered ? [remembered, ...VERSIONS.filter((v) => v !== remembered)] : [...VERSIONS];
}
// Developer-token принадлежит приложению; задаётся в кабинете админа, окружение — фолбэк.
export const googleAdsConfigured = () => !!platformEnvCached("GOOGLE_ADS_DEVELOPER_TOKEN");

export async function call<T>(token: string, path: string, init: { method?: string; body?: unknown; loginCustomerId?: string } = {}): Promise<T> {
    let lastError = "";
    for (const version of versionsToTry()) {
        const res = await fetchProvider(`${baseFor(version)}${path}`, {
            method: init.method ?? "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "developer-token": platformEnvCached("GOOGLE_ADS_DEVELOPER_TOKEN"),
                "Content-Type": "application/json",
                ...(init.loginCustomerId ? { "login-customer-id": init.loginCustomerId } : {}),
            },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
        }, 20000);
        const json = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string } } & T;
        if (res.ok) {
            if (!EXPLICIT_VERSION()) g.__adsVersion = { at: Date.now(), value: version };
            return json;
        }
        const message = json?.error?.message || json?.error?.status || `error ${res.status}`;
        // 404 на самом эндпоинте = версия снята с поддержки: пробуем следующую, не показывая это человеку
        if (res.status === 404) {
            lastError = message;
            continue;
        }
        // PERMISSION_DENIED чаще всего означает «нужен login-customer-id менеджерского аккаунта»
        const hint = /does not have permission|permission_denied|PERMISSION_DENIED/i.test(message)
            ? " — если рекламный аккаунт подключён через менеджерский (MCC), укажите его ID в поле «Аккаунт-менеджер (MCC)»"
            : "";
        throw new ProviderError(`Google Ads: ${message}${hint}`.slice(0, 400));
    }
    throw new ProviderError(
        `Google Ads: версия API недоступна (${lastError || "404"}). Укажите актуальную в переменной GOOGLE_ADS_API_VERSION (сейчас поддерживается v26) или обновите приложение.`.slice(0, 300),
    );
}

export const query = <T>(token: string, customer: string, gaql: string, loginCustomerId?: string) =>
    call<{ results?: T[] }>(token, `/customers/${customer}/googleAds:search`, { method: "POST", body: { query: gaql }, loginCustomerId }).then((r) => r.results ?? []);

// Рекламные аккаунты, к которым у пользователя есть доступ (менеджерские аккаунты без показателей пропускаем)
/** Все аккаунты, к которым у пользователя есть доступ (включая менеджерские). */
export async function accessibleCustomers(token: string): Promise<string[]> {
    const list = await call<{ resourceNames?: string[] }>(token, "/customers:listAccessibleCustomers");
    return (list.resourceNames ?? []).map((r) => r.replace("customers/", "")).slice(0, 25);
}

/** Можно ли обращаться к API от имени этого аккаунта (проверка login-customer-id). */
export async function canLoginAs(token: string, loginCustomerId: string): Promise<boolean> {
    try {
        await query(token, loginCustomerId, "SELECT customer.id FROM customer LIMIT 1", loginCustomerId);
        return true;
    } catch {
        return false;
    }
}

export async function googleAccounts(token: string, loginCustomerId?: string): Promise<AdsAccount[]> {
    const ids = await accessibleCustomers(token);
    const out: AdsAccount[] = [];
    for (const id of ids) {
        try {
            const [row] = await query<{ customer?: { descriptiveName?: string; currencyCode?: string; manager?: boolean } }>(token, id, "SELECT customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1", loginCustomerId);
            if (row?.customer?.manager) continue;
            out.push({ id, name: row?.customer?.descriptiveName || id, currency: row?.customer?.currencyCode || "" });
        } catch {
            out.push({ id, name: id, currency: "" }); // имя не получено (нет прав на этот аккаунт) — пользователь увидит номер
        }
    }
    return out;
}

const num = (v: unknown) => Number(v) || 0;
const day = (d: Date) => d.toISOString().slice(0, 10);

export async function googleInsights(token: string, customer: string, days: number, currency: string, loginCustomerId?: string): Promise<AdsInsights> {
    const to = new Date();
    const from = new Date(Date.now() - (days - 1) * 86400000);
    const range = `segments.date BETWEEN '${day(from)}' AND '${day(to)}'`;
    type Metrics = { costMicros?: string; clicks?: string; impressions?: string; conversions?: number };
    const [daily, camps] = await Promise.all([
        query<{ segments?: { date?: string }; metrics?: Metrics }>(token, customer, `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM customer WHERE ${range} ORDER BY segments.date`, loginCustomerId),
        query<{ campaign?: { id?: string; name?: string; status?: string }; metrics?: Metrics }>(token, customer, `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM campaign WHERE ${range} AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`, loginCustomerId),
    ]);
    const m = (x?: Metrics) => ({ spend: num(x?.costMicros) / 1e6, clicks: num(x?.clicks), impressions: num(x?.impressions), conversions: num(x?.conversions) });
    return {
        currency,
        days: daily.map((r) => ({ date: r.segments?.date ?? "", ...m(r.metrics) })),
        campaigns: camps.map((r) => ({ id: String(r.campaign?.id ?? ""), name: r.campaign?.name ?? "", status: (r.campaign?.status ?? "").toLowerCase(), ...m(r.metrics) })),
    };
}
