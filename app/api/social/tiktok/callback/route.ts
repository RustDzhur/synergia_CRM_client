import { NextResponse } from "next/server";
import { appOrigin, crmLocale, crmOrigin } from "@/lib/appUrl";
import { ProviderError } from "@/lib/http";
import { reportError } from "@/lib/reportError";
import { connectTiktok, exchangeTikTokCode, readTikTokState, tiktokAppConfig } from "@/lib/social/tiktok";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function cookieDomain(origin: string): string | undefined {
    try {
        const host = new URL(origin).hostname;
        if (host === "firmspace.de" || host.endsWith(".firmspace.de")) return ".firmspace.de";
    } catch {
        // некорректный APP_URL — host-only cookie
    }
    return undefined;
}

function cookieValue(header: string, name: string): string {
    for (const part of header.split(";")) {
        const index = part.indexOf("=");
        if (index < 0) continue;
        if (part.slice(0, index).trim() !== name) continue;
        try {
            return decodeURIComponent(part.slice(index + 1).trim());
        } catch {
            return part.slice(index + 1).trim();
        }
    }
    return "";
}

// GET /api/social/tiktok/callback?code=…&state=…
// Ровно этот адрес должен быть указан в TikTok for Developers как Redirect URI:
//   https://firmspace.de/api/social/tiktok/callback
export async function GET(req: Request) {
    const origin = appOrigin(req);
    const q = new URL(req.url).searchParams;
    const state = readTikTokState(q.get("state") ?? "");
    const back = (status: string, message = "") => {
        const u = new URL(`${crmOrigin(req)}/${crmLocale(state?.l)}/crm/settings/integration`);
        u.searchParams.set("tiktok", status);
        if (message) u.searchParams.set("message", message.slice(0, 200));
        const res = NextResponse.redirect(u);
        const domain = cookieDomain(origin);
        res.cookies.set("tiktok_pkce", "", {
            httpOnly: true,
            sameSite: "lax",
            secure: origin.startsWith("https://"),
            path: "/api/social/tiktok/callback",
            maxAge: 0,
            ...(domain ? { domain } : {}),
        });
        return res;
    };

    if (!state) return back("error", "Invalid or expired request. Start the TikTok connection again.");
    const code = q.get("code");
    if (q.get("error") || !code) return back("denied");
    const verifier = cookieValue(req.headers.get("cookie") ?? "", "tiktok_pkce");
    if (!verifier) return back("error", "The OAuth session has expired. Start the TikTok connection again.");
    try {
        const cfg = await tiktokAppConfig();
        if (!cfg.clientKey || !cfg.clientSecret) return back("error", "TikTok app credentials are not configured.");
        const tokens = await exchangeTikTokCode({
            clientKey: cfg.clientKey,
            clientSecret: cfg.clientSecret,
            code,
            codeVerifier: verifier,
            redirectUri: cfg.redirectUri,
        });
        await connectTiktok(state.sub, tokens);
        return back("connected");
    } catch (e) {
        if (!(e instanceof ProviderError)) void reportError(e, { where: "подключение TikTok" });
        return back("error", e instanceof ProviderError ? e.message : "Connection failed");
    }
}
