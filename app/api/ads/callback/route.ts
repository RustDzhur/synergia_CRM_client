import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { appOrigin } from "@/lib/appUrl";
import { ProviderError } from "@/lib/http";
import { connectAds, metaExchange, metaRedirectUri, readMetaState } from "@/lib/ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Сюда Facebook возвращает пользователя после входа: ?code=…&state=… В приложении Meta этот адрес нужно добавить в «Valid OAuth Redirect URIs».
export async function GET(req: Request) {
    const origin = appOrigin(req);
    const q = new URL(req.url).searchParams;
    const state = readMetaState(q.get("state") ?? "");
    if (!state) return new Response("Invalid or expired request. Start again from Marketing.", { status: 400 });
    const back = (status: string, message = "") => {
        const u = new URL(`${origin}/${state.l}/crm/marketing`);
        u.searchParams.set("ads", status);
        if (message) u.searchParams.set("message", message.slice(0, 200));
        return NextResponse.redirect(u);
    };
    const code = q.get("code");
    if (q.get("error") || !code) return back("denied");
    try {
        await connectDB();
        await connectAds(state.sub, "meta", await metaExchange(code, metaRedirectUri(origin)));
        return back("connected");
    } catch (e) {
        return back("error", e instanceof ProviderError ? e.message : "Connection failed");
    }
}
