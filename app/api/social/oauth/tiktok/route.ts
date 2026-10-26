import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { isSocialOwner } from "@/lib/social/api";
import { createPkce, makeTikTokState, tiktokAppConfig, tiktokAuthorizeUrl } from "@/lib/social/tiktok";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const forbidden = () => NextResponse.json({ message: "Only the owner of the platform can connect social publishing" }, { status: 403 });

/**
 * Куда положить cookie с PKCE-verifier. Возврат TikTok идёт на firmspace.de, а настройки открыты
 * на crm.firmspace.de — без Domain=.firmspace.de браузер не отправит cookie на другой хост.
 * Локально (localhost) Domain не ставим: там cookie и так host-only.
 */
function cookieDomain(origin: string): string | undefined {
    try {
        const host = new URL(origin).hostname;
        if (host === "firmspace.de" || host.endsWith(".firmspace.de")) return ".firmspace.de";
    } catch {
        // некорректный APP_URL — оставляем host-only cookie
    }
    return undefined;
}

// POST /api/social/oauth/tiktok — { locale } → { url }
// TikTok OAuth 2.0 требует PKCE: verifier хранится в httpOnly-cookie, в state его не кладём.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!(await isSocialOwner(user))) return forbidden();
    const cfg = await tiktokAppConfig();
    if (!cfg.clientKey || !cfg.clientSecret) {
        return badRequest("TikTok app credentials are not configured: save the client key and client secret in Settings → Integrations → TikTok");
    }
    const body = await req.json().catch(() => ({}));
    const locale = isLocale(body?.locale) ? body.locale : "de";
    try {
        const { verifier, challenge } = createPkce();
        const origin = appOrigin(req);
        const url = tiktokAuthorizeUrl({
            clientKey: cfg.clientKey,
            redirectUri: cfg.redirectUri,
            state: makeTikTokState(user.userId, locale),
            codeChallenge: challenge,
            scopes: cfg.scopes,
        });
        const res = NextResponse.json({ url });
        const domain = cookieDomain(origin);
        res.cookies.set("tiktok_pkce", verifier, {
            httpOnly: true,
            sameSite: "lax",
            secure: origin.startsWith("https://"),
            path: "/api/social/tiktok/callback",
            maxAge: 600,
            ...(domain ? { domain } : {}),
        });
        return res;
    } catch (e) {
        return failure(e);
    }
}
