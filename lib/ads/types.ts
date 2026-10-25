export type AdsPlatform = "google" | "meta";
export const ADS_PLATFORMS: AdsPlatform[] = ["google", "meta"];

export interface AdsAccount { id: string; name: string; currency: string }
export interface AdsDay { date: string; spend: number; clicks: number; impressions: number; conversions: number }
export interface AdsCampaign { id: string; name: string; status: string; spend: number; clicks: number; impressions: number; conversions: number }
export interface AdsCampaignRef { id: string; name: string; status: string; channel: string }
export interface AdsInsights {
    currency: string;
    days: AdsDay[];
    campaigns: AdsCampaign[];
    /** Все кампании аккаунта (включая паузу и нулевые показы) — чтобы созданное было видно сразу. */
    inventory?: AdsCampaignRef[];
}

export interface AdsConnectionDTO {
    id: string;
    platform: AdsPlatform;
    name: string;
    status: "connected" | "error";
    error: string;
    accountId: string; // выбранный рекламный аккаунт; пусто — нужно выбрать из accounts
    currency: string;
    accounts: AdsAccount[];
    expiresAt: number; // 0 — токен обновляется сам (Google); иначе момент, когда нужно войти заново (Meta)
    /** ID аккаунта-менеджера (MCC) для заголовка login-customer-id: нужен, если developer token принадлежит менеджерскому аккаунту. */
    loginCustomerId: string;
}

export interface AdsStatusDTO {
    available: Record<AdsPlatform, boolean>; // настроены ли ключи приложения на сервере
    /** Чего не хватает для Google Ads (имена переменных) — владелец платформы видит точный список. */
    missing?: { google: string[] };
    /** Адрес возврата, который должен быть вписан в Google Cloud Console (Authorized redirect URI). */
    redirectUri?: string;
    planOk: boolean; // разрешает ли тариф фирмы рекламу (app/config/plans.ts)
    connections: AdsConnectionDTO[];
}
