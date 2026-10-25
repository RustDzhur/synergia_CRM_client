import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { appOrigin, crmLocale, crmOrigin } from "@/lib/appUrl";
import { completeMetaOauth } from "@/lib/channels/connect";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/whatsapp/oauth/callback — возврат из окна Facebook: получаем токен, находим аккаунт
// WhatsApp Business и номера. Один номер подключаем сразу, несколько — человек выберет в CRM.
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
            const { options } = await completeMetaOauth(state.sub, "whatsapp", code, origin);
        const status = options.length === 1 ? "connected" : "choose";
        // Возврат — в кабинет CRM (crm.firmspace.de) и только на языке CRM: иначе получалось
        // /ru/ua/crm/... и 404 (сайт добавлял свою локаль к пути CRM).
        const u = new URL(`${crmOrigin(req)}/${crmLocale(locale)}/crm/settings/integration`);
        u.searchParams.set("whatsapp", status);
        return NextResponse.redirect(u);
    } catch (e) {
        const message = e instanceof Error ? e.message : "Connection failed";
        // Возврат — в кабинет CRM (crm.firmspace.de) и только на языке CRM: иначе получалось
        // /ru/ua/crm/... и 404 (сайт добавлял свою локаль к пути CRM).
        const u = new URL(`${crmOrigin(req)}/${crmLocale(locale)}/crm/settings/integration`);
        u.searchParams.set("whatsapp", "error");
        u.searchParams.set("message", message.slice(0, 200));
        return NextResponse.redirect(u);
    }
}
