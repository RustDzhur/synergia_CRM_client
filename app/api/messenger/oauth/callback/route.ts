import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { appOrigin } from "@/lib/appUrl";
import { completeMetaOauth } from "@/lib/channels/connect";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/messenger/oauth/callback — возврат из окна Facebook. Меняем код на токены и выясняем,
// какие страницы доступны: если одна — подключаем сразу, если несколько — человек выберет в CRM.
export async function GET(req: Request) {
    const origin = appOrigin(req);
    const q = new URL(req.url).searchParams;
    let locale = "de";
    try {
        const state = jwt.verify(q.get("state") ?? "", process.env.JWT_SECRET as string) as { sub: string; l?: string };
        if (!state?.sub) throw new Error("bad state");
        locale = isLocale(String(state.l)) ? String(state.l) : "de";
        const code = q.get("code") ?? "";
        if (!code) throw new Error(q.get("error_description") || "Facebook did not return a code");
            const { options } = await completeMetaOauth(state.sub, "messenger", code, origin);
        const status = options.length === 1 ? "connected" : "choose";
        const u = new URL(`${origin}/${locale}/crm/settings/integration`);
        u.searchParams.set("messenger", status);
        return NextResponse.redirect(u);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Connection failed";
        const u = new URL(`${origin}/${locale}/crm/settings/integration`);
        u.searchParams.set("messenger", "error");
        u.searchParams.set("message", message.slice(0, 200));
        return NextResponse.redirect(u);
    }
}
