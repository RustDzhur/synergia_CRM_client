import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, unauthorized } from "@/lib/api";
import { DRIVE_SCOPE } from "@/lib/google/drive";
import { authorizeUrl, makeState, oauthAvailable } from "@/lib/mail/oauth";

export const dynamic = "force-dynamic";

// POST /api/drive/oauth — { locale }: адрес страницы Google, где пользователь разрешает CRM создавать документы на его Диске
// (доступ только к файлам, созданным самой CRM). Возврат — на общий /api/mail/oauth/callback, различаем по полю state.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!oauthAvailable().google) return badRequest("Google sign-in is not configured on this site");
    const body = await req.json().catch(() => ({}));
    const locale = ["en", "de", "ua"].includes(body?.locale) ? body.locale : "en";
    return NextResponse.json({ url: authorizeUrl("google", appOrigin(req), makeState(user.id, "google", locale, "drive"), DRIVE_SCOPE) });
}
