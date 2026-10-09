import { ToolErrorLike } from "./errors";
import { accessToken, adsPlanOk, findAds } from "./index";
import type { AdsAccount } from "./types";

// Контекст Google Ads для робота: подключение фирмы, выбранный аккаунт и свежий токен.
export async function adsContext(org: string) {
    if (!(await adsPlanOk(org))) throw new ToolErrorLike("Advertising is not included in the firm's plan");
    const doc = (await findAds(org, "google"))[0];
    if (!doc) throw new ToolErrorLike("Google Ads is not connected. Ask the owner to connect it: Marketing → Ad performance → Connect Google Ads.");
    const cfg = (doc.config ?? {}) as { accountId?: string; accounts?: AdsAccount[]; loginCustomerId?: string };
    if (!cfg.accountId) throw new ToolErrorLike("Choose the Google Ads account in Marketing → Ad performance first");
    const currency = (cfg.accounts ?? []).find((a) => a.id === cfg.accountId)?.currency ?? "";
    let token: string;
    try { token = await accessToken(doc); } catch (e) { throw new ToolErrorLike(e instanceof Error ? e.message : "Google Ads access failed"); }
    return { doc, token, customer: cfg.accountId, currency, login: cfg.loginCustomerId };
}
