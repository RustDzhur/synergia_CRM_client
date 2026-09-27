import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { avatarMap, cleanDueAt, resolveAudience, toFeedDTO } from "@/lib/feed";
import FeedPost from "@/models/FeedPost";

const forbidden = () => NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });

// PATCH /api/feed/:id — { pinned?, follow? } — любой участник фирмы;
// { emoji } — поставить/снять свой смайлик-реакцию; { kind?, dueAt?, audience?, audienceIds? } — автор, владелец, администратор.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const post = await FeedPost.findOne({ _id: params.id, org: user.id });
    if (!post) return notFound();
    const canEdit = String(post.author) === user.userId || ["owner", "admin"].includes(user.role);

    // смайлик-реакция: у одного человека на запись не больше одной реакции каждым эмодзи
    if (typeof b.emoji === "string") {
        const emoji = b.emoji.trim().slice(0, 8);
        if (!emoji) return badRequest("Emoji is required");
        let entry = post.reactions.find((r: { emoji: string }) => r.emoji === emoji);
        if (!entry) {
            post.reactions.push({ emoji, users: [] });
            entry = post.reactions[post.reactions.length - 1];
        }
        const mine = entry.users.some((u: unknown) => String(u) === user.userId);
        entry.users = mine ? entry.users.filter((u: unknown) => String(u) !== user.userId) : [...entry.users, user.userId];
        // реакции без единого участника в базе не храним
        post.reactions = post.reactions.filter((r: { users: unknown[] }) => r.users.length > 0);
        post.markModified("reactions");
    }

    // «в задачи» / «в новости», срок и адресаты — это уже содержание записи, менять его может автор или руководство
    const editsContent = b.kind !== undefined || b.dueAt !== undefined || b.audience !== undefined;
    if (editsContent) {
        if (!canEdit) return forbidden();
        if (b.kind !== undefined) {
            if (!["post", "news"].includes(b.kind)) return badRequest("Invalid kind");
            post.kind = b.kind;
        }
        if (b.dueAt !== undefined) post.dueAt = cleanDueAt(b.dueAt);
        if (b.audience !== undefined) {
            const wanted = b.audience === "people";
            const { ids, names } = wanted ? await resolveAudience(user.id, b.audienceIds ?? post.audienceIds) : { ids: [], names: [] };
            post.audience = ids.length ? "people" : "all";
            post.audienceIds = ids;
            post.audienceNames = names;
            post.markModified("audienceIds");
        }
    }

    if (typeof b.pinned === "boolean") post.pinned = b.pinned;
    if (typeof b.follow === "boolean") {
        post.followers = b.follow ? [...post.followers.filter((f: unknown) => String(f) !== user.userId), user.userId] : post.followers.filter((f: unknown) => String(f) !== user.userId);
    }

    await post.save();
    const avatars = await avatarMap([String(post.author), ...(post.comments ?? []).map((c: { author: unknown }) => String(c.author))]);
    return NextResponse.json(toFeedDTO(post, user.userId, avatars));
}

// DELETE /api/feed/:id — удалить может автор записи, владелец и администратор
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const post = await FeedPost.findOne({ _id: params.id, org: user.id });
    if (!post) return notFound();
    if (String(post.author) !== user.userId && !["owner", "admin"].includes(user.role)) return forbidden();
    await post.deleteOne();
    return NextResponse.json({ ok: true });
}
