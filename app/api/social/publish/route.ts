import { NextResponse } from "next/server";
import { authorizeSocialOwner, socialQueueStatus } from "@/lib/social/api";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { publishPost } from "@/lib/social/publish";

export const dynamic = "force-dynamic";

// Публикация поста платформы в соцсети: страница Facebook Firmspace + дублирование в Instagram.
// Маршрут закрыт для всех, кроме владельца платформы (администратора): страница и токен — платформенные,
// клиентским фирмам они не принадлежат. Робот «Social Poster» вызывает этот же код напрямую, без HTTP.
//
//   POST /api/social/publish  { text, image? }  → { ok, fbUrl, igUrl, fbPostId, igMediaId, igError? }
//   GET  /api/social/publish                     → очередь: сколько ждёт, что вышло последним
export async function POST(req: Request) {
    const user = await authorizeSocialOwner(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("text is required: the post text in German");
    const image = typeof body?.image === "string" && body.image.trim() ? body.image.trim() : "public/brand/avatar.png";
    try {
        const result = await publishPost({ text, imagePath: image });
        return NextResponse.json({ ok: true, ...result });
    } catch (e) {
        return failure(e);
    }
}

export async function GET(req: Request) {
    const user = await authorizeSocialOwner(req);
    if (!user) return unauthorized(req);
    try {
        return NextResponse.json(await socialQueueStatus());
    } catch (e) {
        return failure(e);
    }
}
