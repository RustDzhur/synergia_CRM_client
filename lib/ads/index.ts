import jwt from "jsonwebtoken";
import { orgFeatures } from "@/lib/features";
import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import { Tokens, oauthAvailable, refreshTokens } from "@/lib/mail/oauth";
import { prisma } from "@/lib/prisma";
import { googleAccounts, googleAdsConfigured, googleInsights } from "./google";
import { META_SCOPE, metaAccounts, metaAuthUrl, metaConfigured, metaExchange, metaInsights } from "./meta";
import type { AdsAccount, AdsConnectionDTO, AdsInsights, AdsPlatform, AdsStatusDTO } from "./types";

type Doc = any;
export { ADS_PLATFORMS } from "./types";
export type { AdsPlatform } from "./types";

export const adsAvailable = (): AdsStatusDTO["available"] => ({ google: oauthAvailable().google && googleAdsConfigured(), meta: metaConfigured() });
export const metaRedirectUri = (origin: string) => `${origin}/api/ads/callback`;

// вынесено из app/api/ads/route.ts — route.ts не может экспортировать ничего, кроме обработчиков HTTP-методов
export async function adsPlanOk(org: string) {
    const o = await prisma.organization.findUnique({ where: { id: org }, select: { plan: true, planOverride: true, planOverrideUntil: true, featureOverrides: true } });
    return orgFeatures(o ?? {}).ads;
}

// Рекламные подключения фирмы: по платформе или все, от старых к новым
export async function findAds(owner: string, platform?: AdsPlatform): Promise<Doc[]> {
    const list = await prisma.integration.findMany({ where: { owner, type: "ads" }, orderBy: { createdAt: "asc" } });
    return platform ? list.filter((d) => ((d.config as any)?.platform ?? "") === platform) : list;
}

export const toConnectionDTO = (d: Doc): AdsConnectionDTO => {
    const cfg = (d.config ?? {}) as any;
    const accounts: AdsAccount[] = cfg.accounts ?? [];
    const chosen = accounts.find((a) => a.id === cfg.accountId);
    return {
        id: String(d.id),
        platform: cfg.platform,
        name: d.name,
        status: d.status,
        error: d.error,
        accountId: cfg.accountId ?? "",
        currency: chosen?.currency ?? "",
        accounts,
        expiresAt: cfg.platform === "meta" ? Number(cfg.expiresAt) || 0 : 0,
    };
};

// Подключение платформы: сохраняем токены и список рекламных аккаунтов; если аккаунт один — выбираем его сразу
export async function connectAds(owner: string, platform: AdsPlatform, tokens: { accessToken: string; refreshToken?: string; expiresAt: number }) {
    if (platform === "google" && !tokens.refreshToken) throw new ProviderError("Google did not allow offline access. Remove the app in your Google account permissions and connect again.");
    const accounts = platform === "google" ? await googleAccounts(tokens.accessToken) : await metaAccounts(tokens.accessToken);
    if (!accounts.length) throw new ProviderError(platform === "google" ? "No Google Ads accounts are available for this Google account" : "No ad accounts are available for this Facebook account");
    const existing = (await findAds(owner, platform))[0];
    const keep = accounts.find((a) => a.id === ((existing?.config as any)?.accountId ?? ""))?.id ?? (accounts.length === 1 ? accounts[0].id : "");
    const data = {
        name: platform === "google" ? "Google Ads" : "Meta Ads",
        config: { platform, accounts, accountId: keep, expiresAt: platform === "meta" ? tokens.expiresAt : 0 } as any,
        secrets: packSecrets(tokens),
        status: "connected",
        error: "",
    };
    return existing
        ? prisma.integration.update({ where: { id: existing.id }, data })
        : prisma.integration.create({ data: { owner, type: "ads", token: randomToken(), ...data } });
}

export async function accessToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if ((d.config as any).platform === "meta") {
        if (s.expiresAt && s.expiresAt < Date.now()) return fail(d, "The Meta access has expired. Connect it again.");
        return s.accessToken;
    }
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) return fail(d, "Connect Google Ads again");
    try {
        const fresh = await refreshTokens("google", s.refreshToken);
        await prisma.integration.update({ where: { id: d.id }, data: { secrets: packSecrets(fresh) } });
        return fresh.accessToken;
    } catch {
        return fail(d, "Google Ads access was revoked. Connect it again.");
    }
}

async function fail(d: Doc, message: string): Promise<never> {
    await prisma.integration.update({ where: { id: d.id }, data: { status: "error", error: message } });
    throw new ProviderError(message);
}

export async function insightsFor(d: Doc, days: number): Promise<AdsInsights> {
    const cfg = (d.config ?? {}) as any;
    const accountId: string = cfg.accountId;
    if (!accountId) throw new ProviderError("Choose an ad account first");
    const currency = (cfg.accounts as AdsAccount[]).find((a) => a.id === accountId)?.currency ?? "";
    const token = await accessToken(d);
    try {
        const out = cfg.platform === "google" ? await googleInsights(token, accountId, days, currency) : await metaInsights(token, accountId, days, currency);
        if (d.status !== "connected") await prisma.integration.update({ where: { id: d.id }, data: { status: "connected", error: "" } });
        return out;
    } catch (e) {
        await prisma.integration.update({ where: { id: d.id }, data: { status: "error", error: e instanceof ProviderError ? e.message : "Could not load ad data" } });
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
