import jwt from "jsonwebtoken";
import type { HydratedDocument } from "mongoose";
import { planFor } from "@/app/config/plans";
import { effectivePlan } from "@/lib/billing";
import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import { Tokens, oauthAvailable, refreshTokens } from "@/lib/mail/oauth";
import Integration from "@/models/Integration";
import Organization from "@/models/Organization";
import { googleAccounts, googleAdsConfigured, googleInsights } from "./google";
import { META_SCOPE, metaAccounts, metaAuthUrl, metaConfigured, metaExchange, metaInsights } from "./meta";
import type { AdsAccount, AdsConnectionDTO, AdsInsights, AdsPlatform, AdsStatusDTO } from "./types";

type Doc = HydratedDocument<any>;
export { ADS_PLATFORMS } from "./types";
export type { AdsPlatform } from "./types";

export const adsAvailable = (): AdsStatusDTO["available"] => ({ google: oauthAvailable().google && googleAdsConfigured(), meta: metaConfigured() });
export const metaRedirectUri = (origin: string) => `${origin}/api/ads/callback`;

// вынесено из app/api/ads/route.ts — route.ts не может экспортировать ничего, кроме обработчиков HTTP-методов
export async function adsPlanOk(org: string) {
    const o = await Organization.findById(org).select("plan planOverride planOverrideUntil");
    return planFor(o ? effectivePlan(o) : "free").features.ads;
}

export const findAds = (owner: string, platform?: AdsPlatform) => Integration.find({ owner, type: "ads", ...(platform ? { "config.platform": platform } : {}) }).sort({ createdAt: 1 });

export const toConnectionDTO = (d: Doc): AdsConnectionDTO => {
    const accounts: AdsAccount[] = d.config.accounts ?? [];
    const chosen = accounts.find((a) => a.id === d.config.accountId);
    return {
        id: String(d._id),
        platform: d.config.platform,
        name: d.name,
        status: d.status,
        error: d.error,
        accountId: d.config.accountId ?? "",
        currency: chosen?.currency ?? "",
        accounts,
        expiresAt: d.config.platform === "meta" ? Number(d.config.expiresAt) || 0 : 0,
    };
};

// Подключение платформы: сохраняем токены и список рекламных аккаунтов; если аккаунт один — выбираем его сразу
export async function connectAds(owner: string, platform: AdsPlatform, tokens: { accessToken: string; refreshToken?: string; expiresAt: number }) {
    if (platform === "google" && !tokens.refreshToken) throw new ProviderError("Google did not allow offline access. Remove the app in your Google account permissions and connect again.");
    const accounts = platform === "google" ? await googleAccounts(tokens.accessToken) : await metaAccounts(tokens.accessToken);
    if (!accounts.length) throw new ProviderError(platform === "google" ? "No Google Ads accounts are available for this Google account" : "No ad accounts are available for this Facebook account");
    const doc = (await findAds(owner, platform))[0] ?? new Integration({ owner, type: "ads", token: randomToken() });
    const keep = accounts.find((a) => a.id === doc.config?.accountId)?.id ?? (accounts.length === 1 ? accounts[0].id : "");
    doc.set({
        name: platform === "google" ? "Google Ads" : "Meta Ads",
        config: { platform, accounts, accountId: keep, expiresAt: platform === "meta" ? tokens.expiresAt : 0 },
        secrets: packSecrets(tokens),
        status: "connected",
        error: "",
    });
    doc.markModified("config");
    await doc.save();
    return doc;
}

export async function accessToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (d.config.platform === "meta") {
        if (s.expiresAt && s.expiresAt < Date.now()) return fail(d, "The Meta access has expired. Connect it again.");
        return s.accessToken;
    }
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) return fail(d, "Connect Google Ads again");
    try {
        const fresh = await refreshTokens("google", s.refreshToken);
        d.secrets = packSecrets(fresh);
        await d.save();
        return fresh.accessToken;
    } catch {
        return fail(d, "Google Ads access was revoked. Connect it again.");
    }
}

async function fail(d: Doc, message: string): Promise<never> {
    d.status = "error";
    d.error = message;
    await d.save();
    throw new ProviderError(message);
}

export async function insightsFor(d: Doc, days: number): Promise<AdsInsights> {
    const accountId: string = d.config.accountId;
    if (!accountId) throw new ProviderError("Choose an ad account first");
    const currency = (d.config.accounts as AdsAccount[]).find((a) => a.id === accountId)?.currency ?? "";
    const token = await accessToken(d);
    try {
        const out = d.config.platform === "google" ? await googleInsights(token, accountId, days, currency) : await metaInsights(token, accountId, days, currency);
        if (d.status !== "connected") { d.status = "connected"; d.error = ""; await d.save(); }
        return out;
    } catch (e) {
        d.status = "error";
        d.error = e instanceof ProviderError ? e.message : "Could not load ad data";
        await d.save();
        throw e;
    }
}

// state для входа через Facebook (подписан, живёт 10 минут)
export const makeMetaState = (owner: string, locale: string) => jwt.sign({ sub: owner, l: locale, p: "ads-meta" }, process.env.JWT_SECRET as string, { expiresIn: "10m" });
export function readMetaState(state: string) {
    try {
        const s = jwt.verify(state, process.env.JWT_SECRET as string) as { sub: string; l: string; p: string };
        return s.p === "ads-meta" ? s : null;
    } catch {
        return null;
    }
}
export const metaAuthorizeUrl = (origin: string, state: string) =>
    `${metaAuthUrl()}?${new URLSearchParams({ client_id: process.env.META_APP_ID ?? "", redirect_uri: metaRedirectUri(origin), state, scope: META_SCOPE, response_type: "code" })}`;
export { metaExchange };
