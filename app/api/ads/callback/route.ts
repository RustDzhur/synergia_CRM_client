import { NextResponse } from "next/server";
import { appOrigin, crmLocale, crmOrigin } from "@/lib/appUrl";
import { connectAds } from "@/lib/ads";
import { adsRedirectUri, exchangeCode, readState } from "@/lib/mail/oauth";
import { ensurePlatformEnv } from "@/lib/platformEnv";
import { ProviderError } from "@/lib/http";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Сюда Google возвращает пользователя после разрешения на рекламный кабинет.
// Отдельный адрес (а не общий «почтовый» колбэк) — чтобы в адресной строке было видно
// именно подключение рекламы, а не смена пароля/почты, и чтобы ошибки не уводили в почту.
export async function GET(req: Request) {
    await ensurePlatformEnv();
    const origin = appOrigin(req);
    const q = new URL(req.url).searchParams;
    const state = readState(q.get("state") ?? "");
    const back = (status: string, message = "") => {
        const locale = crmLocale(state?.l);
        // Возвращаем в CRM-кабинет, а не на основной сайт: на firmspace.de локализованных
        // страниц /<locale>/crm/... нет, и пользователь попадал на 404.
        const u = new URL(`${crmOrigin(req)}/${locale}/crm/marketing`);
        u.searchParams.set("ads", status);
        if (message) u.searchParams.set("message", message.slice(0, 200));
        return NextResponse.redirect(u);
    };
    if (!state || state.p !== "ads") return back("error", "Invalid or expired request. Start again from Marketing → Ad performance.");

    const code = q.get("code");
    if (q.get("error") || !code) return back("denied");
    try {
        const tokens = await exchangeCode(state.v, code, origin, adsRedirectUri(origin));
        await connectAds(state.sub, "google", tokens);
        return back("connected");
    } catch (e) {
        if (!(e instanceof ProviderError)) void reportError(e, { where: "подключение рекламного кабинета" });
        return back("error", e instanceof ProviderError ? e.message : "Connection failed");
    }
}
