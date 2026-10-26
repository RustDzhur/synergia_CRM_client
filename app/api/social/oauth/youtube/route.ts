import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { isSocialOwner } from "@/lib/social/api";
import { YOUTUBE_SCOPES } from "@/lib/social/types";
import { authorizeUrl, makeState, oauthAvailable } from "@/lib/mail/oauth";
import { ensurePlatformEnv } from "@/lib/platformEnv";
import { isLocale } from "@/lib/locales";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const forbidden = () => NextResponse.json({ message: "Only the owner of the platform can connect social publishing" }, { status: 403 });

// POST /api/social/oauth/youtube — { locale } → { url }
// Браузерный переход не может нести Authorization, поэтому пользователь определяется здесь и попадает
// в подписанный state. Возврат идёт на уже зарегистрированный в Google Cloud адрес /api/mail/oauth/callback:
// отдельный redirect URI для YouTube не требуется, меняется только набор scopes (youtube.upload + youtube.readonly).
export async function POST(req: Request) {
    await ensurePlatformEnv();
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!(await isSocialOwner(user))) return forbidden();
    if (!oauthAvailable().google) return badRequest("Google OAuth is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the platform settings");
    const body = await req.json().catch(() => ({}));
    const locale = isLocale(body?.locale) ? body.locale : "de";
    try {
        const url = authorizeUrl("google", appOrigin(req), makeState(user.userId, "google", locale, "youtube"), YOUTUBE_SCOPES);
        return NextResponse.json({ url });
    } catch (e) {
        return failure(e);
    }
}
