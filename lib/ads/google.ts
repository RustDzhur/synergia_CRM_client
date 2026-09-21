import { ProviderError, fetchProvider } from "@/lib/http";
import type { AdsAccount, AdsInsights } from "./types";

// Google Ads API (REST). Нужны: OAuth-клиент Google (тот же, что для почты и Drive) с областью adwords и «developer token»
// рекламного менеджерского аккаунта (GOOGLE_ADS_DEVELOPER_TOKEN). Версия API меняется — задаётся GOOGLE_ADS_API_VERSION.
export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const base = () => (process.env.GOOGLE_ADS_API_URL || `https://googleads.googleapis.com/${process.env.GOOGLE_ADS_API_VERSION || "v21"}`).replace(/\/+$/, "");
export const googleAdsConfigured = () => !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

async function call<T>(token: string, path: string, init: { method?: string; body?: unknown; loginCustomerId?: string } = {}): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, {
        method: init.method ?? "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
            "Content-Type": "application/json",
            ...(init.loginCustomerId ? { "login-customer-id": init.loginCustomerId } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }, 20000);
    const json = (await res.json().catch(() => null)) as { error?: { message?: string; status?: string } } & T;
    if (!res.ok) throw new ProviderError(`Google Ads: ${json?.error?.message || json?.error?.status || `error ${res.status}`}`.slice(0, 300));
    return json;
}

const query = <T>(token: string, customer: string, gaql: string, loginCustomerId?: string) =>
    call<{ results?: T[] }>(token, `/customers/${customer}/googleAds:search`, { method: "POST", body: { query: gaql }, loginCustomerId }).then((r) => r.results ?? []);

// Рекламные аккаунты, к которым у пользователя есть доступ (менеджерские аккаунты без показателей пропускаем)
export async function googleAccounts(token: string): Promise<AdsAccount[]> {
    const list = await call<{ resourceNames?: string[] }>(token, "/customers:listAccessibleCustomers");
    const ids = (list.resourceNames ?? []).map((r) => r.replace("customers/", "")).slice(0, 25);
    const out: AdsAccount[] = [];
    for (const id of ids) {
        try {
            const [row] = await query<{ customer?: { descriptiveName?: string; currencyCode?: string; manager?: boolean } }>(token, id, "SELECT customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1");
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

export async function googleInsights(token: string, customer: string, days: number, currency: string): Promise<AdsInsights> {
    const to = new Date();
    const from = new Date(Date.now() - (days - 1) * 86400000);
    const range = `segments.date BETWEEN '${day(from)}' AND '${day(to)}'`;
    type Metrics = { costMicros?: string; clicks?: string; impressions?: string; conversions?: number };
    const [daily, camps] = await Promise.all([
        query<{ segments?: { date?: string }; metrics?: Metrics }>(token, customer, `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM customer WHERE ${range} ORDER BY segments.date`),
        query<{ campaign?: { id?: string; name?: string; status?: string }; metrics?: Metrics }>(token, customer, `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM campaign WHERE ${range} AND campaign.status != 'REMOVED' ORDER BY metrics.cost_micros DESC LIMIT 20`),
    ]);
    const m = (x?: Metrics) => ({ spend: num(x?.costMicros) / 1e6, clicks: num(x?.clicks), impressions: num(x?.impressions), conversions: num(x?.conversions) });
    return {
        currency,
        days: daily.map((r) => ({ date: r.segments?.date ?? "", ...m(r.metrics) })),
        campaigns: camps.map((r) => ({ id: String(r.campaign?.id ?? ""), name: r.campaign?.name ?? "", status: (r.campaign?.status ?? "").toLowerCase(), ...m(r.metrics) })),
    };
}
