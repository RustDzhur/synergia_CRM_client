import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { announcePost, avatarMap, cleanDueAt, feedAvatars, resolveAudience, toFeedDTO, userName } from "@/lib/feed";
import FeedPost from "@/models/FeedPost";

export const dynamic = "force-dynamic";

// GET /api/feed — последние 100 записей ленты фирмы (с аватарками авторов и комментариев)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const posts = await FeedPost.find({ org: user.id }).sort({ createdAt: -1 }).limit(100);
    const avatars = await feedAvatars(posts);
    return NextResponse.json(posts.map((p) => toFeedDTO(p, user.userId, avatars)));
}

// POST /api/feed — { text, kind?, dueAt?, audience?, audienceIds? } новая запись; коллеги получают уведомление
// (запись «лично» — только адресаты). audienceIds — id участников фирмы: один человек = лично, несколько = группе.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const text = typeof b?.text === "string" ? b.text.trim().slice(0, 2000) : "";
    if (!text) return badRequest("Text is required");
    await connectDB();
    const kind = b?.kind === "news" ? "news" : "post";
    const wanted = b?.audience === "people";
    const { ids, names } = wanted ? await resolveAudience(user.id, b?.audienceIds) : { ids: [], names: [] };
    const post = await FeedPost.create({
        org: user.id,
        author: user.userId,
        authorName: await userName(user.userId),
        kind,
        text,
        dueAt: cleanDueAt(b?.dueAt),
        audience: ids.length ? "people" : "all",
        audienceIds: ids,
        audienceNames: names,
    });
    await announcePost(user.id, post);
    return NextResponse.json(toFeedDTO(post, user.userId, await avatarMap([user.userId])), { status: 201 });
}
