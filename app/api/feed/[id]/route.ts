import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { avatarMap, cleanDueAt, resolveAudience, toFeedDTO } from "@/lib/feed";
import { prisma } from "@/lib/prisma";

const forbidden = () => NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });

// PATCH /api/feed/:id — { pinned?, follow? } — любой участник фирмы;
// { emoji } — поставить/снять свой смайлик-реакцию; { kind?, dueAt?, audience?, audienceIds? } — автор, владелец, администратор.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const post = await prisma.feedPost.findFirst({ where: { id: params.id, org: user.id } });
    if (!post) return notFound();
    const canEdit = String(post.author) === user.userId || ["owner", "admin"].includes(user.role);
    const data: Record<string, any> = {};

    // смайлик-реакция: у одного человека на запись не больше одной реакции каждым эмодзи
    if (typeof b.emoji === "string") {
        const emoji = b.emoji.trim().slice(0, 8);
        if (!emoji) return badRequest("Emoji is required");
        const reactions = [...((post.reactions as any[]) ?? [])];
        let entry = reactions.find((r: { emoji: string }) => r.emoji === emoji);
        if (!entry) {
            entry = { emoji, users: [] as unknown[] };
            reactions.push(entry);
        }
        const mine = entry.users.some((u: unknown) => String(u) === user.userId);
        entry.users = mine ? entry.users.filter((u: unknown) => String(u) !== user.userId) : [...entry.users, user.userId];
        // реакции без единого участника в базе не храним
        data.reactions = reactions.filter((r: { users: unknown[] }) => r.users.length > 0);
    }

    // «в задачи» / «в новости», срок и адресаты — это уже содержание записи, менять его может автор или руководство
    const editsContent = b.kind !== undefined || b.dueAt !== undefined || b.audience !== undefined;
    if (editsContent) {
        if (!canEdit) return forbidden();
        if (b.kind !== undefined) {
            if (!["post", "news"].includes(b.kind)) return badRequest("Invalid kind");
            data.kind = b.kind;
        }
        if (b.dueAt !== undefined) data.dueAt = cleanDueAt(b.dueAt);
        if (b.audience !== undefined) {
            const wanted = b.audience === "people";
            const { ids, names } = wanted ? await resolveAudience(user.id, b.audienceIds ?? post.audienceIds) : { ids: [], names: [] };
            data.audience = ids.length ? "people" : "all";
            data.audienceIds = ids;
            data.audienceNames = names;
        }
    }

    if (typeof b.pinned === "boolean") data.pinned = b.pinned;
    if (typeof b.follow === "boolean") {
        data.followers = b.follow ? [...post.followers.filter((f: unknown) => String(f) !== user.userId), user.userId] : post.followers.filter((f: unknown) => String(f) !== user.userId);
    }

    const updated = await prisma.feedPost.update({ where: { id: post.id }, data });
    const avatars = await avatarMap([String(updated.author), ...((updated.comments as any[]) ?? []).map((c: { author: unknown }) => String(c.author))]);
    return NextResponse.json(toFeedDTO(updated, user.userId, avatars));
}

// DELETE /api/feed/:id — удалить может автор записи, владелец и администратор
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const post = await prisma.feedPost.findFirst({ where: { id: params.id, org: user.id } });
    if (!post) return notFound();
    if (String(post.author) !== user.userId && !["owner", "admin"].includes(user.role)) return forbidden();
    await prisma.feedPost.deleteMany({ where: { id: post.id } });
    return NextResponse.json({ ok: true });
}
