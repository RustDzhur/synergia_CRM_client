import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { announceComment, toFeedDTO, userName } from "@/lib/feed";
import FeedPost from "@/models/FeedPost";

// POST /api/feed/:id/comments — { text }
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => null);
    const text = typeof b?.text === "string" ? b.text.trim().slice(0, 500) : "";
    if (!text) return badRequest("Text is required");
    await connectDB();
    const authorName = await userName(user.userId);
    const before = await FeedPost.findOne({ _id: params.id, org: user.id });
    if (!before) return notFound();
    const post = await FeedPost.findOneAndUpdate(
        { _id: params.id, org: user.id },
        { $push: { comments: { author: user.userId, authorName, text } }, $addToSet: { followers: user.userId } }, // кто прокомментировал — следит за веткой
        { new: true }
    );
    if (!post) return notFound();
    const added = post.comments[post.comments.length - 1];
    await announceComment(user.id, before, String(added._id), user.userId, authorName, text);
    return NextResponse.json(toFeedDTO(post, user.userId), { status: 201 });
}
