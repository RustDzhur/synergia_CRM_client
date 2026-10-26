import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { ensurePlatformEnv } from "@/lib/platformEnv";
import { socialOwner, socialQueueStatus } from "@/lib/social/api";
import { youtubeStatus } from "@/lib/social/youtube";
import { disconnectTiktok, saveTiktokApp, tiktokStatus } from "@/lib/social/tiktok";
import { disconnectYoutube } from "@/lib/social/youtube";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const forbidden = () => NextResponse.json({ message: "Only the owner of the platform can configure social publishing" }, { status: 403 });

async function statusPayload(req: Request) {
    await ensurePlatformEnv();
    const origin = appOrigin(req);
    const [youtube, tiktok, queue] = await Promise.all([youtubeStatus(), tiktokStatus(), socialQueueStatus()]);
    return {
        youtube: {
            ...youtube,
            // Адрес возврата уже зарегистрирован в Google Cloud (общий колбэк почты) — владельцу не нужно добавлять новый.
            redirectUri: `${origin}${youtube.redirectPath}`,
        },
        tiktok,
        queue,
    };
}

// GET /api/social/settings — состояние YouTube/TikTok для карточек настроек (без токенов).
export async function GET(req: Request) {
    const auth = await socialOwner(req);
    if (!auth) return unauthorized(req);
    if (!auth.owner) return forbidden();
    try {
        return NextResponse.json(await statusPayload(req));
    } catch (e) {
        return failure(e);
    }
}

// PUT /api/social/settings — сохранить ключи приложения TikTok (client key, secret, redirect URI, scopes, режим).
// Клиентский секрет не показываем и не перезаписываем пустым значением: пусто — оставить прежний.
export async function PUT(req: Request) {
    const auth = await socialOwner(req);
    if (!auth) return unauthorized(req);
    if (!auth.owner) return forbidden();
    const body = await req.json().catch(() => null);
    if (!body || body.platform !== "tiktok") return badRequest("platform must be tiktok");
    try {
        await saveTiktokApp({
            clientKey: typeof body.clientKey === "string" ? body.clientKey : undefined,
            clientSecret: typeof body.clientSecret === "string" ? body.clientSecret : undefined,
            redirectUri: typeof body.redirectUri === "string" ? body.redirectUri : undefined,
            scopes: typeof body.scopes === "string" ? body.scopes : undefined,
            mode: typeof body.mode === "string" ? body.mode : undefined,
        });
        return NextResponse.json(await statusPayload(req));
    } catch (e) {
        return failure(e);
    }
}

// DELETE /api/social/settings?platform=youtube|tiktok — отключить публикацию (токены стираются).
export async function DELETE(req: Request) {
    const auth = await socialOwner(req);
    if (!auth) return unauthorized(req);
    if (!auth.owner) return forbidden();
    const platform = new URL(req.url).searchParams.get("platform") ?? "";
    try {
        if (platform === "youtube") await disconnectYoutube();
        else if (platform === "tiktok") await disconnectTiktok();
        else return badRequest("platform must be youtube or tiktok");
        return NextResponse.json(await statusPayload(req));
    } catch (e) {
        return failure(e);
    }
}
