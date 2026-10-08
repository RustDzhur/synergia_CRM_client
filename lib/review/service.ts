import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

// Проверка документов специалистом и запросы клиенту (docs/TZ_MASTER.md §5, п. 6).
// Статусы: draft → needs_review → approved | needs_fix → needs_review. Одобряют владелец, администратор и специалист практики;
// отправить на проверку и вернуть после исправления может любой, кто работает с финансами. Отметка лежит в поле review самого
// документа и разрешена даже в закрытом периоде (она не меняет учёт).

export class ReviewError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

export const REVIEW_STATUSES = ["draft", "needs_review", "approved", "needs_fix"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_KINDS = ["invoices", "expenses"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export interface ReviewMark { status: ReviewStatus; by: string; byName: string; at: string; note: string }

const REVIEWER_ROLES = ["owner", "admin", "advisor", "counsel"];
const note = (v: unknown) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, 500) : "");
export const cleanReview = (v: unknown): ReviewMark | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    return (REVIEW_STATUSES as readonly string[]).includes(String(o.status)) ? { status: o.status as ReviewStatus, by: String(o.by ?? ""), byName: String(o.byName ?? ""), at: String(o.at ?? ""), note: String(o.note ?? "") } : null;
};

type Actor = { userId: string; name: string; role: string };

function checkTransition(from: ReviewStatus, to: ReviewStatus, role: string) {
    if (!(REVIEW_STATUSES as readonly string[]).includes(to)) throw new ReviewError("Invalid status");
    if ((to === "approved" || to === "needs_fix") && !REVIEWER_ROLES.includes(role)) throw new ReviewError("Only the owner, an administrator or a specialist can approve or return a document", 403);
    if (to === "needs_review" && from === "approved" && !REVIEWER_ROLES.includes(role)) throw new ReviewError("An approved document can be reopened for review only by a reviewer", 403);
}

async function load(org: string, kind: ReviewKind, id: string) {
    const row = kind === "invoices" ? await prisma.invoice.findFirst({ where: { id, org }, select: { id: true, review: true } }) : await prisma.expense.findFirst({ where: { id, org }, select: { id: true, review: true } });
    if (!row) throw new ReviewError("Document not found", 404);
    return row;
}

export async function setReview(org: string, kind: ReviewKind, id: string, actor: Actor, status: ReviewStatus, noteText?: unknown): Promise<ReviewMark> {
    const row = await load(org, kind, id);
    const from = cleanReview(row.review)?.status ?? "draft";
    checkTransition(from, status, actor.role);
    const mark: ReviewMark = { status, by: actor.userId, byName: actor.name, at: new Date().toISOString(), note: note(noteText) };
    if (kind === "invoices") await prisma.invoice.update({ where: { id }, data: { review: mark as never } });
    else await prisma.expense.update({ where: { id }, data: { review: mark as never } });
    return mark;
}

/** Пакетное одобрение: только документы, у которых действительно стоит «на проверке»; остальные не трогаются. */
export async function approveMany(org: string, kind: ReviewKind, ids: string[], actor: Actor): Promise<{ approved: number; skipped: number }> {
    if (!REVIEWER_ROLES.includes(actor.role)) throw new ReviewError("Only the owner, an administrator or a specialist can approve", 403);
    const unique = Array.from(new Set(ids.filter((x) => typeof x === "string"))).slice(0, 200);
    let approved = 0;
    for (const id of unique) {
        const row = kind === "invoices" ? await prisma.invoice.findFirst({ where: { id, org }, select: { review: true } }) : await prisma.expense.findFirst({ where: { id, org }, select: { review: true } });
        if (!row || cleanReview(row.review)?.status !== "needs_review") continue;
        await setReview(org, kind, id, actor, "approved");
        approved++;
    }
    return { approved, skipped: unique.length - approved };
}

/** Очередь проверки: документы со статусом «на проверке» или «нужны правки». */
export async function reviewQueue(org: string, kind: ReviewKind, status?: string) {
    const st = status && (REVIEW_STATUSES as readonly string[]).includes(status) ? [status] : ["needs_review", "needs_fix"];
    const where = { org, OR: st.map((s) => ({ review: { path: ["status"], equals: s } })) };
    if (kind === "invoices") {
        const rows = await prisma.invoice.findMany({ where: where as never, orderBy: { issueDate: "desc" }, take: 200, select: { id: true, number: true, customerName: true, issueDate: true, currency: true, status: true, review: true, items: true } });
        return rows.map((r) => ({ id: r.id, title: r.number, party: r.customerName, date: r.issueDate, currency: r.currency, status: r.status, review: cleanReview(r.review) }));
    }
    const rows = await prisma.expense.findMany({ where: where as never, orderBy: { date: "desc" }, take: 200, select: { id: true, vendor: true, date: true, amount: true, currency: true, review: true } });
    return rows.map((r) => ({ id: r.id, title: r.vendor, party: r.vendor, date: r.date, currency: r.currency, amount: r.amount, review: cleanReview(r.review) }));
}

// ── запросы клиенту ────────────────────────────────────────────────────────────────────────────────────────

export async function createRequest(org: string, actor: Actor, input: { subject?: unknown; body?: unknown; entityType?: unknown; entityId?: unknown; link?: string }) {
    if (!REVIEWER_ROLES.includes(actor.role)) throw new ReviewError("Only the owner, an administrator or a specialist can send requests", 403);
    const subject = note(input.subject).slice(0, 200);
    if (subject.length < 3) throw new ReviewError("Describe the request");
    const entityType = ["invoice", "expense", "bank"].includes(String(input.entityType)) ? String(input.entityType) : "";
    const entityId = entityType && typeof input.entityId === "string" ? input.entityId.slice(0, 40) : "";
    const req = await prisma.clientRequest.create({ data: { org, link: input.link ?? "", createdBy: actor.userId, createdName: actor.name, subject, body: note(input.body), entityType, entityId } });
    // клиент видит запрос уведомлением; адресуем владельцам и администраторам фирмы
    const admins = await prisma.membership.findMany({ where: { org, role: { in: ["owner", "admin"] } }, select: { user: true } });
    await Promise.all(admins.map((m) => notify(org, { type: "client_request", user: m.user, params: { name: actor.name, subject }, link: "/crm/finance", key: `req:${req.id}:${m.user}` })));
    return req;
}

export const listRequests = (org: string, status?: string) => prisma.clientRequest.findMany({ where: { org, ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });

/** Ответ на запрос (клиент) или отмена (автор/проверяющий). Закрытый запрос не переоткрывается — задаётся новый. */
export async function answerRequest(org: string, actor: Actor, id: string, input: { answer?: unknown; cancel?: unknown }) {
    const req = await prisma.clientRequest.findFirst({ where: { id, org } });
    if (!req) throw new ReviewError("Request not found", 404);
    if (req.status !== "open") throw new ReviewError("The request is already closed", 409);
    if (input.cancel === true) {
        if (req.createdBy !== actor.userId && !["owner", "admin"].includes(actor.role)) throw new ReviewError("Only the author can cancel the request", 403);
        return prisma.clientRequest.update({ where: { id }, data: { status: "cancelled", answeredBy: actor.userId, answeredAt: new Date() } });
    }
    const answer = note(input.answer);
    if (!answer) throw new ReviewError("Write an answer");
    const updated = await prisma.clientRequest.update({ where: { id }, data: { status: "answered", answer, answeredBy: actor.userId, answeredAt: new Date() } });
    await notify(org, { type: "request_answered", user: req.createdBy, params: { name: actor.name, subject: req.subject }, link: "/crm/finance", key: `ans:${id}` });
    return updated;
}
