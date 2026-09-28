import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { metaAppConfigured } from "@/lib/channels/connect";

export const dynamic = "force-dynamic";

// GET /api/integrations/meta — настроено ли на сайте приложение Meta (META_APP_ID и META_APP_SECRET).
// Если да, окно подключения Messenger и WhatsApp не спрашивает ключи: кнопка входа работает сразу.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ configured: await metaAppConfigured() });
}
