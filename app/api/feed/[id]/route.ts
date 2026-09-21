import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { toFeedDTO } from "@/lib/feed";
import FeedPost from "@/models/FeedPost";

// PATCH /api/feed/:id — { pinned?: boolean, follow?: boolean }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const update: Record<string, unknown> = {};
    if (typeof b.pinned === "boolean") update.$set = { pinned: b.pinned };
    if (typeof b.follow === "boolean") update[b.follow ? "$addToSet" : "$pull"] = { followers: user.userId };
    const post = await FeedPost.findOneAndUpdate({ _id: params.id, org: user.id }, update, { new: true });
    return post ? NextResponse.json(toFeedDTO(post, user.userId)) : notFound();
}

// DELETE /api/feed/:id — удалить может автор записи, владелец и администратор
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const post = await FeedPost.findOne({ _id: params.id, org: user.id });
    if (!post) return notFound();
    if (String(post.author) !== user.userId && !["owner", "admin"].includes(user.role)) return NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });
    await post.deleteOne();
    return NextResponse.json({ ok: true });
}
