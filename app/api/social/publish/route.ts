import { NextResponse } from "next/server";
import { socialOwner, socialQueueStatus } from "@/lib/social/api";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { publishPost } from "@/lib/social/publish";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// Публикация поста платформы в соцсети: страница Facebook Firmspace + Instagram, а для видео —
// YouTube и TikTok. Маршрут закрыт для всех, кроме владельца платформы (администратора): страница
// и токены — платформенные, клиентским фирмам они не принадлежат. Робот «Social Poster» вызывает
// этот же код напрямую, без HTTP.
//
//   POST /api/social/publish  { text, image?, video?, mediaType?, targets?, title?, tags?, privacyStatus?, confirmPublic? }
//        → { ok, fbUrl, igUrl, youtubeUrl, tiktokPublishId, errors, … }
//   GET  /api/social/publish  → очередь: сколько ждёт, что вышло последним
const forbidden = () => NextResponse.json({ message: "Only the owner of the platform can publish to its social page" }, { status: 403 });

export async function POST(req: Request) {
    const auth = await socialOwner(req);
    if (!auth) return unauthorized(req);
    if (!auth.owner) return forbidden();
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("text is required: the post text in German");
    const rawVideo = typeof body?.video === "string" ? body.video.trim() : typeof body?.videoPath === "string" ? body.videoPath.trim() : "";
    const mediaType = body?.mediaType === "video" || rawVideo ? "video" : "image";
    const image = typeof body?.image === "string" && body.image.trim()
        ? body.image.trim()
        : mediaType === "image"
          ? "public/brand/avatar.png"
          : "";
    if (mediaType === "video" && !rawVideo) return badRequest("video is required for mediaType=video: give a path inside public/");
    try {
        const result = await publishPost({
            text,
            imagePath: image || undefined,
            videoPath: rawVideo || undefined,
            mediaType,
            targets: body?.targets,
            title: typeof body?.title === "string" ? body.title : undefined,
            description: typeof body?.description === "string" ? body.description : undefined,
            tags: body?.tags,
            privacyStatus: typeof body?.privacyStatus === "string" ? body.privacyStatus : undefined,
            confirmPublic: body?.confirmPublic === true,
        });
        return NextResponse.json({ ok: true, ...result });
    } catch (e) {
        return failure(e);
    }
}

export async function GET(req: Request) {
    const auth = await socialOwner(req);
    if (!auth) return unauthorized(req);
    if (!auth.owner) return forbidden();
    try {
        return NextResponse.json(await socialQueueStatus());
    } catch (e) {
        return failure(e);
    }
}
