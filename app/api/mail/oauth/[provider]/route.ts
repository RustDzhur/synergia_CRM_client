import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, unauthorized } from "@/lib/api";
import { authorizeUrl, makeState, oauthAvailable } from "@/lib/mail/oauth";

export const dynamic = "force-dynamic";

// POST /api/mail/oauth/google|microsoft — { locale }: адрес страницы входа у провайдера.
// Браузерный переход не может нести заголовок Authorization, поэтому пользователь определяется здесь и попадает в подписанный state.
export async function POST(req: Request, { params }: { params: { provider: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const vendor = params.provider === "google" || params.provider === "microsoft" ? params.provider : null;
    if (!vendor || !oauthAvailable()[vendor]) return badRequest("This sign-in method is not configured");
    const body = await req.json().catch(() => ({}));
    const locale = ["en", "de", "ua"].includes(body?.locale) ? body.locale : "en";
    return NextResponse.json({ url: authorizeUrl(vendor, appOrigin(req), makeState(user.id, vendor, locale)) });
}
