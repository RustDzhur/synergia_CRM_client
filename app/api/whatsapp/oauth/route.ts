import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, unauthorized } from "@/lib/api";
import { startMetaOauth } from "@/lib/channels/connect";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";

// POST /api/whatsapp/oauth — { appId, appSecret, locale }: начало входа через Facebook для WhatsApp.
// Так же, как у Messenger: человек выбирает аккаунт в окне Meta, а номер и его id мы находим сами.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const locale = isLocale(String(b.locale)) ? String(b.locale) : "de";
    try {
            const state = jwt.sign({ sub: user.id, l: locale, p: "meta" }, process.env.JWT_SECRET as string, { expiresIn: "15m" });
        const url = await startMetaOauth(user.id, "whatsapp", String(b.appId ?? "").trim(), String(b.appSecret ?? "").trim(), appOrigin(req), state);
        return NextResponse.json({ url });
    } catch (e) {
        return badRequest(e instanceof Error ? e.message : "Could not start the connection");
    }
}
