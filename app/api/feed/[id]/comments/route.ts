import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { announceComment, feedAvatars, toFeedDTO, userName } from "@/lib/feed";
import { prisma } from "@/lib/prisma";

// POST /api/feed/:id/comments — { text }
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => null);
    const text = typeof b?.text === "string" ? b.text.trim().slice(0, 500) : "";
    if (!text) return badRequest("Text is required");
    const authorName = await userName(user.userId);
    const before = await prisma.feedPost.findFirst({ where: { id: params.id, org: user.id } });
    if (!before) return notFound();
    // Комментарий живёт в Json: id и createdAt задаём сами (в Mongo их выдавала поддокументу база)
    const comment = { id: randomUUID(), author: user.userId, authorName, text, createdAt: new Date().toISOString() };
    const comments = [...((before.comments as any[]) ?? []), comment];
    // кто прокомментировал — следит за веткой
    const followers = before.followers.includes(user.userId) ? before.followers : [...before.followers, user.userId];
    const post = await prisma.feedPost.update({ where: { id: before.id }, data: { comments: comments as any, followers } });
    await announceComment(user.id, before, comment.id, user.userId, authorName, text);
    return NextResponse.json(toFeedDTO(post, user.userId, await feedAvatars([post])), { status: 201 });
}
