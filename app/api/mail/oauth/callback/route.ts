import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/appUrl";
import { connectAds } from "@/lib/ads";
import { connectDrive, connectGcal } from "@/lib/google";
import { connectOAuthAccount, syncAccount } from "@/lib/mail";
import { connectOnedrive } from "@/lib/onedrive";
import { exchangeCode, readState } from "@/lib/mail/oauth";
import { reportError } from "@/lib/reportError";
import { ProviderError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Сюда провайдер возвращает пользователя после входа: ?code=…&state=…
export async function GET(req: Request) {
    const origin = appOrigin(req);
    const q = new URL(req.url).searchParams;
    const state = readState(q.get("state") ?? "");
    if (!state) return new Response("Invalid or expired request. Start again from Web Mails.", { status: 400 });

    // тот же адрес возврата обслуживает и вход в Google Drive, OneDrive (Online Documents) и Google Ads (Marketing) — различаем по state
    const drive = state.p === "drive";
    const ads = state.p === "ads";
    const gcal = state.p === "gcal";
    const onedrive = state.p === "onedrive";
    const back = (status: string, message = "") => {
        const section = ads ? "marketing" : gcal ? "collaboration/calendar" : `collaboration/${drive || onedrive ? "online-documents" : "web-mails"}`;
        const u = new URL(`${origin}/${state.l}/crm/${section}`);
        u.searchParams.set(ads ? "ads" : gcal ? "gcal" : onedrive ? "onedrive" : drive ? "drive" : "mail", status);
        if (message) u.searchParams.set("message", message.slice(0, 200));
        return NextResponse.redirect(u);
    };

    const code = q.get("code");
    if (q.get("error") || !code) return back("denied");
    try {
            const tokens = await exchangeCode(state.v, code, origin);
        if (ads) {
            await connectAds(state.sub, "google", tokens);
            return back("connected");
        }
        if (gcal) {
            await connectGcal(state.sub, tokens);
            return back("connected");
        }
        if (drive) {
            await connectDrive(state.sub, tokens);
            return back("connected");
        }
        if (onedrive) {
            await connectOnedrive(state.sub, tokens);
            return back("connected");
        }
        const account = await connectOAuthAccount(state.sub, state.v, tokens);
        await syncAccount(account).catch(() => undefined); // первое наполнение; при ошибке пользователь увидит статус ящика
        return back("connected");
    } catch (e) {
        // Ответ провайдера человек увидит в разделе, а неожиданный сбой иначе остался бы без следа
        if (!(e instanceof ProviderError)) void reportError(e, { where: "подключение внешнего сервиса" });
        return back("error", e instanceof ProviderError ? e.message : "Connection failed");
    }
}
