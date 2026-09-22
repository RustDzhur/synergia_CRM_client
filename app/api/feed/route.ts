import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { announcePost, toFeedDTO, userName } from "@/lib/feed";
import FeedPost from "@/models/FeedPost";

export const dynamic = "force-dynamic";

// GET /api/feed — последние 100 записей ленты фирмы
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const posts = await FeedPost.find({ org: user.id }).sort({ createdAt: -1 }).limit(100);
    return NextResponse.json(posts.map((p) => toFeedDTO(p, user.userId)));
}

// POST /api/feed — { text } новый пост; коллеги получают уведомление
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const text = typeof b?.text === "string" ? b.text.trim().slice(0, 2000) : "";
    if (!text) return badRequest("Text is required");
    await connectDB();
    const post = await FeedPost.create({ org: user.id, author: user.userId, authorName: await userName(user.userId), kind: "post", text });
    await announcePost(user.id, post);
    return NextResponse.json(toFeedDTO(post, user.userId), { status: 201 });
}
