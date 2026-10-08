import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { ReviewError } from "./service";

// Комментарии к документам с упоминаниями (docs/TZ_MASTER.md §5.2 п. 6). Упомянуть можно только участника этой же фирмы
// (включая специалистов с действующей связью); упомянутый получает уведомление.

export const COMMENT_KINDS = ["invoices", "expenses", "legal"] as const;
type Kind = (typeof COMMENT_KINDS)[number];
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, " ").trim().slice(0, max) : "");

async function ensureEntity(org: string, kind: Kind, id: string) {
    const ok = kind === "invoices" ? await prisma.invoice.findFirst({ where: { id, org }, select: { id: true } })
        : kind === "expenses" ? await prisma.expense.findFirst({ where: { id, org }, select: { id: true } })
        : await prisma.legalDoc.findFirst({ where: { id, org }, select: { id: true } });
    if (!ok) throw new ReviewError("Document not found", 404);
}

export async function people(org: string) {
    const ms = await prisma.membership.findMany({ where: { org }, select: { user: true } });
    const users = await prisma.user.findMany({ where: { id: { in: ms.map((m) => m.user) } }, select: { id: true, firstname: true, lastname: true } });
    return users.map((u) => ({ id: u.id, name: `${u.firstname} ${u.lastname}`.trim() }));
}

export async function listComments(org: string, kind: Kind, id: string) {
    await ensureEntity(org, kind, id);
    return { comments: await prisma.docComment.findMany({ where: { org, entityType: kind, entityId: id }, orderBy: { createdAt: "asc" }, take: 200 }), people: await people(org) };
}

export async function addComment(org: string, actor: { userId: string; name: string }, kind: Kind, id: string, input: { text?: unknown; mentions?: unknown }) {
    await ensureEntity(org, kind, id);
    const text = clean(input.text, 2000);
    if (!text) throw new ReviewError("Write a comment");
    const wanted = Array.from(new Set((Array.isArray(input.mentions) ? input.mentions : []).filter((x): x is string => typeof x === "string"))).slice(0, 10);
    const valid = new Set((await prisma.membership.findMany({ where: { org, user: { in: wanted } }, select: { user: true } })).map((m) => m.user));
    const mentions = wanted.filter((u) => valid.has(u) && u !== actor.userId);
    const c = await prisma.docComment.create({ data: { org, entityType: kind, entityId: id, author: actor.userId, authorName: actor.name, text, mentions } });
    await Promise.all(mentions.map((user) => notify(org, { type: "mention", user, params: { name: actor.name, text: text.slice(0, 80) }, link: "/crm/finance", key: `mention:${c.id}:${user}` })));
    return c;
}
