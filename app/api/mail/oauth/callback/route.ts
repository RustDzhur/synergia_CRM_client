import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { appOrigin } from "@/lib/appUrl";
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

    const back = (status: string, message = "") => {
        const u = new URL(`${origin}/${state.l}/crm/collaboration/web-mails`);
        u.searchParams.set("mail", status);
        if (message) u.searchParams.set("message", message.slice(0, 200));
        return NextResponse.redirect(u);
    };

    const code = q.get("code");
    if (q.get("error") || !code) return back("denied");
    try {
        await connectDB();
        const tokens = await exchangeCode(state.v, code, origin);
        const account = await connectOAuthAccount(state.sub, state.v, tokens);
        await syncAccount(account).catch(() => undefined); // первое наполнение; при ошибке пользователь увидит статус ящика
        return back("connected");
    } catch (e) {
        return back("error", e instanceof ProviderError ? e.message : "Connection failed");
    }
}
