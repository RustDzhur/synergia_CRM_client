import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { appOrigin } from "@/lib/appUrl";
import { connectAds } from "@/lib/ads";
import { connectDrive } from "@/lib/google";
import { connectOAuthAccount, syncAccount } from "@/lib/mail";
import { exchangeCode, readState } from "@/lib/mail/oauth";
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

    // тот же адрес возврата обслуживает и вход в Google Drive (Online Documents) и Google Ads (Marketing) — различаем по state
    const drive = state.p === "drive";
    const ads = state.p === "ads";
    const back = (status: string, message = "") => {
        const u = new URL(`${origin}/${state.l}/crm/${ads ? "marketing" : `collaboration/${drive ? "online-documents" : "web-mails"}`}`);
        u.searchParams.set(ads ? "ads" : drive ? "drive" : "mail", status);
        if (message) u.searchParams.set("message", message.slice(0, 200));
        return NextResponse.redirect(u);
    };

    const code = q.get("code");
    if (q.get("error") || !code) return back("denied");
    try {
        await connectDB();
        const tokens = await exchangeCode(state.v, code, origin);
        if (ads) {
            await connectAds(state.sub, "google", tokens);
            return back("connected");
        }
        if (drive) {
            await connectDrive(state.sub, tokens);
            return back("connected");
        }
        const account = await connectOAuthAccount(state.sub, state.v, tokens);
        await syncAccount(account).catch(() => undefined); // первое наполнение; при ошибке пользователь увидит статус ящика
        return back("connected");
    } catch (e) {
        return back("error", e instanceof ProviderError ? e.message : "Connection failed");
    }
}
