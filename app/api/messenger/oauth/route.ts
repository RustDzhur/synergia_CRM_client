import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { startMetaOauth } from "@/lib/channels/connect";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";

// POST /api/messenger/oauth — { appId, appSecret, locale }: начало входа через Facebook.
// App id и секрет приложения берутся в Meta → Settings → Basic. Секрет нужен и дальше — им же
// проверяется подпись событий, — поэтому он сохраняется зашифрованным до возврата из Facebook.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const locale = isLocale(String(b.locale)) ? String(b.locale) : "de";
    try {
            // в state кладём фирму и язык: по нему человек вернётся на свою языковую версию страницы
        const state = jwt.sign({ sub: user.id, l: locale, p: "meta" }, process.env.JWT_SECRET as string, { expiresIn: "15m" });
        const url = await startMetaOauth(user.id, "messenger", String(b.appId ?? "").trim(), String(b.appSecret ?? "").trim(), appOrigin(req), state);
        return NextResponse.json({ url });
    } catch (e) {
        if (e instanceof Error && !(e as { status?: number }).status) return failure(e);
        return badRequest(e instanceof Error ? e.message : "Could not start the connection");
    }
}
