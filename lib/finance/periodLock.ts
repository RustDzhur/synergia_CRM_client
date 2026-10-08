import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Закрытие периода (docs/TZ_MASTER.md §5, п. 7). Пока период закрыт, документы и операции с датой внутри него нельзя ни создать,
// ни изменить, ни удалить — проверка стоит на СЕРВЕРЕ в каждом маршруте записи финансовых сущностей (tests/periodLock.test.ts
// следит, чтобы новый маршрут записи не появился без неё). Исправления — сторно или корректировочным документом в открытом периоде.
// Повторное открытие — владелец, администратор или специалист с доступом на проверку, с обязательной причиной; запись о закрытии остаётся.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class PeriodLockedError extends Error {
    constructor(public from: string, public to: string, public date: string) {
        super(`The period ${from} – ${to} is closed`);
    }
}

export const lockedBody = (e: PeriodLockedError) => ({ message: e.message, code: "period_locked", from: e.from, to: e.to, date: e.date });
export const lockedResponse = (e: PeriodLockedError) => NextResponse.json(lockedBody(e), { status: 423 });

const iso = (d: unknown): string => {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    const s = typeof d === "string" ? d.slice(0, 10) : "";
    return DATE.test(s) ? s : new Date().toISOString().slice(0, 10);
};

/** Закрытый период, в который попадает дата (без даты — сегодняшняя). */
export async function lockedPeriod(org: string, date?: unknown): Promise<{ from: string; to: string; date: string } | null> {
    const day = iso(date);
    const lock = await prisma.periodLock.findFirst({ where: { org, reopenedAt: null, from: { lte: day }, to: { gte: day } }, orderBy: { lockedAt: "desc" } });
    return lock ? { from: lock.from, to: lock.to, date: day } : null;
}

/** Бросает PeriodLockedError, если любая из дат попадает в закрытый период. Пустые значения пропускаются. */
export async function assertPeriodOpen(org: string, ...dates: unknown[]): Promise<void> {
    const seen = new Set<string>();
    for (const d of dates) {
        if (d === undefined || d === null || d === "") continue;
        const day = iso(d);
        if (seen.has(day)) continue;
        seen.add(day);
        const hit = await lockedPeriod(org, day);
        if (hit) throw new PeriodLockedError(hit.from, hit.to, day);
    }
}

/** Для маршрутов: вернуть готовый ответ 423 или null, если можно писать. */
export async function guardPeriod(org: string, ...dates: unknown[]): Promise<NextResponse | null> {
    try {
        await assertPeriodOpen(org, ...dates);
        return null;
    } catch (e) {
        if (e instanceof PeriodLockedError) return lockedResponse(e);
        throw e;
    }
}

// ── управление периодами ───────────────────────────────────────────────────────────────────────────────────

export class PeriodError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

export interface ChecklistItem { code: string; count: number; severity: "blocker" | "warning" }

/** Что мешает закрыть период: неразнесённое, черновики, документы на проверке, открытые запросы клиенту. */
export async function closingChecklist(org: string, from: string, to: string): Promise<ChecklistItem[]> {
    const [unmatched, drafts, needsReview, needsFix, requests, noReceipt] = await Promise.all([
        prisma.bankTransaction.count({ where: { org, date: { gte: from, lte: to }, matchType: "" } }),
        prisma.invoice.count({ where: { org, status: "draft", issueDate: { gte: from, lte: to } } }),
        prisma.invoice.count({ where: { org, issueDate: { gte: from, lte: to }, review: { path: ["status"], equals: "needs_review" } } }),
        prisma.invoice.count({ where: { org, issueDate: { gte: from, lte: to }, review: { path: ["status"], equals: "needs_fix" } } }),
        prisma.clientRequest.count({ where: { org, status: "open" } }),
        prisma.expense.count({ where: { org, date: { gte: from, lte: to }, receipt: null } }),
    ]);
    const items: ChecklistItem[] = [
        { code: "unmatched_bank", count: unmatched, severity: "blocker" },
        { code: "draft_invoices", count: drafts, severity: "blocker" },
        { code: "needs_fix", count: needsFix, severity: "blocker" },
        { code: "needs_review", count: needsReview, severity: "warning" },
        { code: "open_requests", count: requests, severity: "warning" },
        { code: "expenses_no_receipt", count: noReceipt, severity: "warning" },
    ];
    return items.filter((i) => i.count > 0);
}

export async function listPeriods(org: string) {
    return prisma.periodLock.findMany({ where: { org }, orderBy: { lockedAt: "desc" }, take: 60 });
}

/** Закрыть период. Есть блокирующие замечания — нужен явный acknowledge: человек видит, что закрывает с открытыми хвостами. */
export async function closePeriod(org: string, actor: { userId: string; name: string }, input: { from?: unknown; to?: unknown; note?: unknown; acknowledge?: unknown }) {
    const from = String(input.from ?? ""), to = String(input.to ?? "");
    if (!DATE.test(from) || !DATE.test(to) || from > to) throw new PeriodError("from and to must be dates (YYYY-MM-DD), from not after to");
    const overlap = await prisma.periodLock.findFirst({ where: { org, reopenedAt: null, from: { lte: to }, to: { gte: from } } });
    if (overlap) throw new PeriodError(`The period overlaps the closed period ${overlap.from} – ${overlap.to}`, 409);
    const checklist = await closingChecklist(org, from, to);
    if (checklist.some((i) => i.severity === "blocker") && input.acknowledge !== true) {
        const err = new PeriodError("There are open items in this period", 409) as PeriodError & { checklist?: ChecklistItem[] };
        err.checklist = checklist;
        throw err;
    }
    const lock = await prisma.periodLock.create({ data: { org, from, to, note: typeof input.note === "string" ? input.note.trim().slice(0, 300) : "", lockedBy: actor.userId, lockedByName: actor.name } });
    return { lock, checklist };
}

/** Открыть период заново. Причина обязательна и остаётся в записи. */
export async function reopenPeriod(org: string, actor: { userId: string; name: string }, id: string, reason: unknown) {
    const why = typeof reason === "string" ? reason.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, 300) : "";
    if (why.length < 3) throw new PeriodError("A reason is required to reopen a closed period");
    const lock = await prisma.periodLock.findFirst({ where: { id, org } });
    if (!lock) throw new PeriodError("Period not found", 404);
    if (lock.reopenedAt) return lock;
    return prisma.periodLock.update({ where: { id }, data: { reopenedAt: new Date(), reopenedBy: actor.userId, reopenReason: `${why} (${actor.name})`.slice(0, 400) } });
}

/** Оборачивает обработчик маршрута: закрытый период (PeriodLockedError из сторожа базы) становится ответом 423, а не «Server error». */
export const withPeriodLock = <A extends unknown[]>(handler: (...args: A) => Promise<Response>) =>
    async (...args: A): Promise<Response> => {
        try {
            return await handler(...args);
        } catch (e) {
            if (e instanceof PeriodLockedError) return lockedResponse(e);
            throw e;
        }
    };
