import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { parseBankCsv } from "@/lib/finance/bank";
import { importBankRows } from "@/lib/finance/bankImport";
import { registerPayment, revertPayment } from "@/lib/sync/payments";
import { prisma } from "@/lib/prisma";
import { withPeriodLock } from "@/lib/finance/periodLock";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const toDTO = (t: any) => ({
    id: t.id,
    account: String(t.account),
    date: t.date,
    amount: t.amount,
    currency: t.currency ?? "EUR",
    counterparty: t.counterparty ?? "",
    reference: t.reference ?? "",
    matchType: t.matchType ?? "",
    matchId: t.matchId ? String(t.matchId) : "",
    source: t.source ?? "manual",
    notes: t.notes ?? "",
    category: t.category ?? "",
});

// GET /api/bank/transactions?account=&from=&to=&unmatched=1 — движения по счёту или кассе
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const accountId = url.searchParams.get("account") ?? "";
    const filter: Record<string, unknown> = { org: user.id };
    if (validId(accountId)) filter.account = accountId;
    const from = str(url.searchParams.get("from"), 10);
    const to = str(url.searchParams.get("to"), 10);
    if (DATE.test(from) || DATE.test(to)) {
        filter.date = {};
        if (DATE.test(from)) (filter.date as Record<string, string>).gte = from;
        if (DATE.test(to)) (filter.date as Record<string, string>).lte = to;
    }
    // «Unvollständig» в интерфейсе — это ровно движения без привязки
    if (url.searchParams.get("unmatched") === "1") filter.matchType = "";

    const list = await prisma.bankTransaction.findMany({ where: filter as any, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500 });
    return NextResponse.json({ transactions: list.map(toDTO) });
}

// POST /api/bank/transactions — добавить движение вручную (кассовая книга, разовый приход).
// import=1 — тело содержит { csv } выписки: строки разбираются терпимым парсером,
// дубликаты отсекаются по внешнему идентификатору, а к каждой новой строке сразу
// подбирается предполагаемая пара (счёт клиенту или расход) — но только как подсказка.
async function handlePOST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);

    const accountId = str(b?.account, 40);
    if (!validId(accountId)) return badRequest("account is required");
    const account = await prisma.bankAccount.findFirst({ where: { id: accountId, org: user.id } });
    if (!account) return badRequest("Account not found");

    if (typeof b?.csv === "string") {
        const parsed = parseBankCsv(b.csv);
        if (!parsed.rows.length) return badRequest("No transactions found in the file");

        // Запись строк — общая с синхронизацией по API (lib/finance/bankImport.ts): дубликаты не
        // задваиваются, к новым строкам подбирается предполагаемая пара с подсказкой
        const { created, skipped, suggestions } = await importBankRows(user.id, account, parsed.rows, "import");
        return NextResponse.json({
            imported: created.length,
            skipped: parsed.skipped + skipped,
            suggestions,
            transactions: created.map(toDTO),
        }, { status: 201 });
    }

    const date = str(b?.date, 10);
    if (!DATE.test(date)) return badRequest("date must be YYYY-MM-DD");
    const amount = Number(b?.amount);
    if (!Number.isFinite(amount) || amount === 0) return badRequest("amount must not be zero");

    const doc = await prisma.bankTransaction.create({
        data: {
            org: user.id, account: account.id, date, amount: Math.round(amount * 100) / 100, currency: account.currency,
            counterparty: str(b?.counterparty, 200), reference: str(b?.reference), notes: str(b?.notes, 1000), source: "manual",
        },
    });
    return NextResponse.json(toDTO(doc), { status: 201 });
}

// DELETE /api/bank/transactions?account= — очистить все движения по счёту (например, ошибочный импорт)
async function handleDELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const accountId = url.searchParams.get("account") ?? "";

    if (validId(id)) {
        const removed = await prisma.bankTransaction.deleteMany({ where: { id, org: user.id } });
        return removed.count ? NextResponse.json({ ok: true }) : badRequest("Transaction not found");
    }
    if (validId(accountId) && url.searchParams.get("all") === "1") {
        const res = await prisma.bankTransaction.deleteMany({ where: { org: user.id, account: accountId, source: "import" } });
        return NextResponse.json({ ok: true, removed: res.count ?? 0 });
    }
    return badRequest("id or account with all=1 is required");
}

// PATCH /api/bank/transactions — привязать движение к счёту клиенту или расходу, либо снять привязку
async function handlePATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const id = str(b?.id, 40);
    if (!validId(id)) return badRequest("id is required");

    const tx = await prisma.bankTransaction.findFirst({ where: { id, org: user.id } });
    if (!tx) return badRequest("Transaction not found");

    const matchType = b?.matchType === "invoice" || b?.matchType === "expense" || b?.matchType === "manual" ? b.matchType : "";
    const matchId = str(b?.matchId, 40);
    if (matchType && !validId(matchId)) return badRequest("matchId is required when matching");

    // проверяем, что привязываем к своей записи, а не к чужой
    if (matchType === "invoice" && !(await prisma.invoice.findFirst({ where: { id: matchId, org: user.id }, select: { id: true } }))) return badRequest("Invoice not found");
    if (matchType === "expense" && !(await prisma.expense.findFirst({ where: { id: matchId, org: user.id }, select: { id: true } }))) return badRequest("Expense not found");

    // Привязка движения к счёту — это те же деньги, которых ждёт счёт, поэтому оплату учитываем
    // здесь же: иначе сверка оставалась бы «бумажной», а счёт вечно вис «к оплате». Снятие привязки
    // возвращает сумму назад. Учёт — общий с кнопкой «оплачен», webhook и ассистентом (lib/sync/payments.ts):
    // оплата с банка запускает автоматизацию, пишет в ленту клиента и пробивает чек так же, как остальные.
    // Ключ платежа — id банковской строки: повторная привязка той же строки не прибавит сумму дважды.
    const wasInvoice = tx.matchType === "invoice" && tx.matchId ? String(tx.matchId) : "";
    const nowInvoice = matchType === "invoice" ? matchId : "";
    const actor = { userId: user.userId };
    if (wasInvoice && wasInvoice !== nowInvoice) await revertPayment(user.id, wasInvoice, { source: "bank", externalId: tx.id, amount: Math.abs(tx.amount), actor });
    if (nowInvoice && nowInvoice !== wasInvoice) {
        const res = await registerPayment(user.id, nowInvoice, { amount: Math.abs(tx.amount), source: "bank", externalId: tx.id, paidAt: /^\d{4}-\d{2}-\d{2}$/.test(String(tx.date)) ? new Date(`${tx.date}T12:00:00.000Z`) : undefined, via: "bank", actor });
        if (res.ok && !res.duplicate) await emit(user.id, { type: "bank_matched", data: { id: nowInvoice, number: res.invoice.number, customerName: res.invoice.customerName, amount: String(Math.abs(tx.amount)), dealId: res.invoice.deal ?? "" } });
    }

    const data: Record<string, any> = { matchType, matchId: matchType ? matchId : null };
    if (typeof b?.notes === "string") data.notes = str(b.notes, 1000);
    const updated = await prisma.bankTransaction.update({ where: { id: tx.id }, data });
    return NextResponse.json(toDTO(updated));
}

// Закрытый период (сторож в lib/prisma.ts) отвечает здесь 423, а не «Server error»
export const POST = withPeriodLock(handlePOST);
export const DELETE = withPeriodLock(handleDELETE);
export const PATCH = withPeriodLock(handlePATCH);
