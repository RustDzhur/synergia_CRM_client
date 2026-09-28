import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, serverError } from "@/lib/api";
import { metaApp, setMetaApp } from "@/lib/platformSettings";

export const dynamic = "force-dynamic";

// Приложение Meta для всей платформы: через него фирмы подключают свои страницы Facebook и номера
// WhatsApp. Задаётся один раз администратором, а не каждой фирмой. Только для администратора платформы.

// GET — что настроено: App ID отдаём, секрет нет (он нужен только серверу)
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    try {
        const app = await metaApp();
        return NextResponse.json({ appId: app.appId, hasSecret: !!app.appSecret, fromEnv: !!(process.env.META_APP_ID && process.env.META_APP_SECRET) });
    } catch (e) {
        return serverError(e);
    }
}

// POST { appId, appSecret } — сохранить. Пустой секрет оставляет прежний: его не показывают и не переписывают зря.
export async function POST(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const appId = String(b.appId ?? "").trim();
    const appSecret = String(b.appSecret ?? "").trim();
    if (!/^\d{6,20}$/.test(appId)) return badRequest("The App ID is a number — copy it from Meta → Settings → Basic");
    if (appSecret && (appSecret.length < 20 || appSecret.length > 60)) return badRequest("The App Secret is a 32-character string — copy it from Meta → Settings → Basic");
    try {
        await setMetaApp(appId, appSecret);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return serverError(e);
    }
}
