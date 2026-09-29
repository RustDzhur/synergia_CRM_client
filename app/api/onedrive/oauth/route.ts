import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, unauthorized } from "@/lib/api";
import { ONEDRIVE_SCOPE, authorizeUrl, makeState, oauthAvailable } from "@/lib/mail/oauth";

export const dynamic = "force-dynamic";

// POST /api/onedrive/oauth — { locale }: адрес страницы Microsoft, где пользователь разрешает CRM
// видеть и переносить файлы его OneDrive. Возврат — на общий /api/mail/oauth/callback, различаем по state.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!oauthAvailable().microsoft) return badRequest("Microsoft sign-in is not configured on this site");
    const body = await req.json().catch(() => ({}));
    const locale = ["en", "de", "ua"].includes(body?.locale) ? body.locale : "en";
    return NextResponse.json({ url: authorizeUrl("microsoft", appOrigin(req), makeState(user.id, "microsoft", locale, "onedrive"), ONEDRIVE_SCOPE) });
}
