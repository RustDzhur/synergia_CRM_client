import { ProviderError, fetchProvider } from "@/lib/http";
import type { AdsAccount, AdsInsights } from "./types";

// Meta (Facebook + Instagram) Marketing API. Нужно приложение Meta с правом ads_read (META_APP_ID / META_APP_SECRET).
// Токен пользователя долгоживущий (~60 дней), автоматически не обновляется: по истечении нужно войти заново.
export const META_SCOPE = "ads_read";
const VER = () => process.env.META_GRAPH_VERSION || "v23.0";
const graph = () => (process.env.META_GRAPH_URL || `https://graph.facebook.com/${VER()}`).replace(/\/+$/, "");
export const metaAuthUrl = () => process.env.META_OAUTH_URL || `https://www.facebook.com/${VER()}/dialog/oauth`;
export const metaConfigured = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetchProvider(`${graph()}${path}?${new URLSearchParams(params)}`, {}, 20000);
    const json = (await res.json().catch(() => null)) as { error?: { message?: string } } & T;
    if (!res.ok || (json as { error?: unknown })?.error) throw new ProviderError(`Meta: ${json?.error?.message || `error ${res.status}`}`.slice(0, 300));
    return json;
}

// code → короткий токен → долгоживущий (60 дней)
export async function metaExchange(code: string, redirectUri: string): Promise<{ accessToken: string; expiresAt: number }> {
    const short = await get<{ access_token: string }>("/oauth/access_token", { client_id: process.env.META_APP_ID ?? "", client_secret: process.env.META_APP_SECRET ?? "", redirect_uri: redirectUri, code });
    const long = await get<{ access_token: string; expires_in?: number }>("/oauth/access_token", { grant_type: "fb_exchange_token", client_id: process.env.META_APP_ID ?? "", client_secret: process.env.META_APP_SECRET ?? "", fb_exchange_token: short.access_token });
    return { accessToken: long.access_token, expiresAt: Date.now() + (long.expires_in ?? 60 * 86400) * 1000 };
}

export async function metaAccounts(token: string): Promise<AdsAccount[]> {
    const r = await get<{ data?: { account_id: string; name?: string; currency?: string }[] }>("/me/adaccounts", { access_token: token, fields: "account_id,name,currency", limit: "50" });
    return (r.data ?? []).map((a) => ({ id: a.account_id, name: a.name || a.account_id, currency: a.currency || "" }));
}

const num = (v: unknown) => Number(v) || 0;
const day = (d: Date) => d.toISOString().slice(0, 10);
// Действия, которые считаем «конверсиями»: заявки и покупки
const CONVERSION = /^(lead|purchase|omni_purchase|onsite_conversion\.lead_grouped|offsite_conversion\.fb_pixel_(lead|purchase))$/;
const conversions = (actions?: { action_type: string; value: string }[]) => (actions ?? []).filter((a) => CONVERSION.test(a.action_type)).reduce((s, a) => s + num(a.value), 0);

interface Row { date_start?: string; campaign_id?: string; campaign_name?: string; spend?: string; impressions?: string; clicks?: string; actions?: { action_type: string; value: string }[] }

export async function metaInsights(token: string, accountId: string, days: number, currency: string): Promise<AdsInsights> {
    const range = JSON.stringify({ since: day(new Date(Date.now() - (days - 1) * 86400000)), until: day(new Date()) });
    const common = { access_token: token, time_range: range, limit: "500" };
    const fields = "spend,impressions,clicks,actions";
    const [daily, camps, statuses] = await Promise.all([
        get<{ data?: Row[] }>(`/act_${accountId}/insights`, { ...common, fields, time_increment: "1" }),
        get<{ data?: Row[] }>(`/act_${accountId}/insights`, { ...common, fields: `campaign_id,campaign_name,${fields}`, level: "campaign" }),
        get<{ data?: { id: string; effective_status?: string }[] }>(`/act_${accountId}/campaigns`, { access_token: token, fields: "id,effective_status", limit: "200" }).catch(() => ({ data: [] })),
    ]);
    const status = new Map((statuses.data ?? []).map((c) => [c.id, (c.effective_status ?? "").toLowerCase()]));
    const m = (r: Row) => ({ spend: num(r.spend), clicks: num(r.clicks), impressions: num(r.impressions), conversions: conversions(r.actions) });
    return {
        currency,
        days: (daily.data ?? []).map((r) => ({ date: r.date_start ?? "", ...m(r) })),
        campaigns: (camps.data ?? []).map((r) => ({ id: r.campaign_id ?? "", name: r.campaign_name ?? "", status: status.get(r.campaign_id ?? "") ?? "", ...m(r) })).sort((a, b) => b.spend - a.spend).slice(0, 20),
    };
}
