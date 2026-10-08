import { prisma } from "@/lib/prisma";
import { marketOf } from "@/lib/finance/market";
import { memberOf, PracticeError } from "./service";
import { upcomingDeadlines } from "./deadlines";

// Панель «Мои клиенты»: по одной строке на действующую связь, где сотрудник включён в members. Данные — только агрегаты (числа и даты),
// без содержимого документов. Каждое обращение к клиенту записывается в его журнал доступа (клиент видит, кто смотрел панель).

export interface ClientRow {
    link: string; org: string; orgName: string; access: string; market: string | null;
    unmatchedBank: number; overdueInvoices: number; needsReview: number; needsFix: number; openRequests: number;
    closedUntil: string | null; lastActivity: string | null;
    deadlines: ReturnType<typeof upcomingDeadlines>;
}

export async function practiceDashboard(practiceId: string, userId: string, userName = ""): Promise<ClientRow[]> {
    if (!(await memberOf(practiceId, userId))) throw new PracticeError("Practice not found", 404);
    const now = new Date();
    const links = await prisma.clientLink.findMany({ where: { practice: practiceId, status: "active", members: { has: userId }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } });
    const today = now.toISOString().slice(0, 10);
    const rows: ClientRow[] = [];
    for (const l of links) {
        if (!l.org) continue;
        const org = l.org;
        const [o, fs, unmatched, overdue, needsReview, needsFix, requests, lock, access, inv] = await Promise.all([
            prisma.organization.findUnique({ where: { id: org }, select: { name: true } }),
            prisma.financeSettings.findUnique({ where: { org }, select: { country: true } }),
            prisma.bankTransaction.count({ where: { org, matchType: "" } }),
            prisma.invoice.count({ where: { org, status: { in: ["sent", "overdue"] }, dueDate: { not: "", lt: today } } }),
            prisma.invoice.count({ where: { org, review: { path: ["status"], equals: "needs_review" } } }),
            prisma.invoice.count({ where: { org, review: { path: ["status"], equals: "needs_fix" } } }),
            prisma.clientRequest.count({ where: { org, status: "open" } }),
            prisma.periodLock.findFirst({ where: { org, reopenedAt: null }, orderBy: { to: "desc" }, select: { to: true } }),
            prisma.accessLogEntry.findFirst({ where: { org }, orderBy: { at: "desc" }, select: { at: true } }),
            prisma.invoice.findFirst({ where: { org }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
        ]);
        const market = marketOf(fs?.country);
        const last = [access?.at, inv?.updatedAt].filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0];
        rows.push({ link: l.id, org, orgName: o?.name ?? "", access: l.access, market, unmatchedBank: unmatched, overdueInvoices: overdue, needsReview, needsFix, openRequests: requests, closedUntil: lock?.to ?? null, lastActivity: last ? last.toISOString() : null, deadlines: upcomingDeadlines(market, now) });
        await prisma.accessLogEntry.create({ data: { org, link: l.id, user: userId, userName, action: "read", module: "dashboard", method: "GET", path: `/api/practice/${practiceId}/dashboard` } }).catch(() => undefined);
    }
    return rows;
}
