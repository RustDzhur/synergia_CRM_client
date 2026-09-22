import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, unauthorized } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import { adsAvailable, adsPlanOk, makeMetaState, metaAuthorizeUrl } from "@/lib/ads";
import { GOOGLE_ADS_SCOPE } from "@/lib/ads/google";
import { authorizeUrl, makeState } from "@/lib/mail/oauth";

export const dynamic = "force-dynamic";

// POST /api/ads/oauth — { platform: "google" | "meta", locale }: адрес страницы, где пользователь разрешает читать статистику рекламы
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    if (!(await adsPlanOk(user.id))) return NextResponse.json({ message: "Ad performance (Google Ads / Meta Ads) needs the Standard plan or higher.", code: "plan_limit" }, { status: 402 });
    const b = await req.json().catch(() => ({}));
    const locale = ["en", "de", "ua"].includes(b?.locale) ? b.locale : "en";
    const origin = appOrigin(req);
    if (b?.platform === "google") {
        if (!adsAvailable().google) return badRequest("Google Ads is not configured on this site (needs Google sign-in keys and GOOGLE_ADS_DEVELOPER_TOKEN)");
        // возврат — на общий адрес Google-входа (/api/mail/oauth/callback), различаем по полю state
        return NextResponse.json({ url: authorizeUrl("google", origin, makeState(user.id, "google", locale, "ads"), GOOGLE_ADS_SCOPE) });
    }
    if (b?.platform === "meta") {
        if (!adsAvailable().meta) return badRequest("Meta Ads is not configured on this site (needs META_APP_ID and META_APP_SECRET)");
        return NextResponse.json({ url: metaAuthorizeUrl(origin, makeMetaState(user.id, locale)) });
    }
    return badRequest("Unknown platform");
}
