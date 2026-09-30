import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { parseBankCsv } from "@/lib/finance/bank";
import { importBankRows } from "@/lib/finance/bankImport";
import BankAccount from "@/models/BankAccount";
import BankTransaction from "@/models/BankTransaction";
import { applyPayment, statusAfterPayment } from "@/lib/finance/payments";
import Invoice from "@/models/Invoice";
import Expense from "@/models/Expense";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const toDTO = (t: any) => ({
    id: String(t._id),
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
});

// GET /api/bank/transactions?account=&from=&to=&unmatched=1 — движения по счёту или кассе
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const url = new URL(req.url);
    const accountId = url.searchParams.get("account") ?? "";
    const filter: Record<string, unknown> = { org: user.id };
    if (validId(accountId)) filter.account = accountId;
    const from = str(url.searchParams.get("from"), 10);
    const to = str(url.searchParams.get("to"), 10);
    if (DATE.test(from) || DATE.test(to)) {
        filter.date = {};
        if (DATE.test(from)) (filter.date as Record<string, string>).$gte = from;
        if (DATE.test(to)) (filter.date as Record<string, string>).$lte = to;
    }
    // «Unvollständig» в интерфейсе — это ровно движения без привязки
    if (url.searchParams.get("unmatched") === "1") filter.matchType = "";

    const list = await BankTransaction.find(filter).sort({ date: -1, createdAt: -1 }).limit(500);
    return NextResponse.json({ transactions: list.map(toDTO) });
}

// POST /api/bank/transactions — добавить движение вручную (кассовая книга, разовый приход).
// import=1 — тело содержит { csv } выписки: строки разбираются терпимым парсером,
// дубликаты отсекаются по внешнему идентификатору, а к каждой новой строке сразу
// подбирается предполагаемая пара (счёт клиенту или расход) — но только как подсказка.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    await connectDB();

    const accountId = str(b?.account, 40);
    if (!validId(accountId)) return badRequest("account is required");
    const account = await BankAccount.findOne({ _id: accountId, org: user.id });
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

    const doc = await BankTransaction.create({
        org: user.id, account: account._id, date, amount: Math.round(amount * 100) / 100, currency: account.currency,
        counterparty: str(b?.counterparty, 200), reference: str(b?.reference), notes: str(b?.notes, 1000), source: "manual",
    });
    return NextResponse.json(toDTO(doc), { status: 201 });
}

// DELETE /api/bank/transactions?account= — очистить все движения по счёту (например, ошибочный импорт)
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const accountId = url.searchParams.get("account") ?? "";

    if (validId(id)) {
        const removed = await BankTransaction.findOneAndDelete({ _id: id, org: user.id });
        return removed ? NextResponse.json({ ok: true }) : badRequest("Transaction not found");
    }
    if (validId(accountId) && url.searchParams.get("all") === "1") {
        const res = await BankTransaction.deleteMany({ org: user.id, account: accountId, source: "import" });
        return NextResponse.json({ ok: true, removed: res.deletedCount ?? 0 });
    }
    return badRequest("id or account with all=1 is required");
}

// PATCH /api/bank/transactions — привязать движение к счёту клиенту или расходу, либо снять привязку
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const id = str(b?.id, 40);
    if (!validId(id)) return badRequest("id is required");
    await connectDB();

    const tx = await BankTransaction.findOne({ _id: id, org: user.id });
    if (!tx) return badRequest("Transaction not found");

    const matchType = b?.matchType === "invoice" || b?.matchType === "expense" || b?.matchType === "manual" ? b.matchType : "";
    const matchId = str(b?.matchId, 40);
    if (matchType && !validId(matchId)) return badRequest("matchId is required when matching");

    // проверяем, что привязываем к своей записи, а не к чужой
    if (matchType === "invoice" && !(await Invoice.exists({ _id: matchId, org: user.id }))) return badRequest("Invoice not found");
    if (matchType === "expense" && !(await Expense.exists({ _id: matchId, org: user.id }))) return badRequest("Expense not found");

    // Привязка движения к счёту — это те же деньги, которых ждёт счёт, поэтому оплату учитываем
    // здесь же: иначе сверка оставалась бы «бумажной», а счёт вечно вис «к оплате». Снятие привязки
    // возвращает сумму назад.
    const wasInvoice = tx.matchType === "invoice" && tx.matchId ? String(tx.matchId) : "";
    const nowInvoice = matchType === "invoice" ? matchId : "";
    if (wasInvoice && wasInvoice !== nowInvoice) await bookPayment(user.id, wasInvoice, -Math.abs(tx.amount), user.userId, "unmatched");
    if (nowInvoice && nowInvoice !== wasInvoice) await bookPayment(user.id, nowInvoice, Math.abs(tx.amount), user.userId, "matched");

    tx.matchType = matchType;
    tx.matchId = matchType ? matchId : undefined;
    if (typeof b?.notes === "string") tx.notes = str(b.notes, 1000);
    await tx.save();
    return NextResponse.json(toDTO(tx));
}

// Учитывает деньги по счёту: приход из выписки закрывает оплату, отвязка — снимает её.
// Статус и сумма считаются общим правилом (lib/finance/payments.ts), журнал хранит обе операции.
async function bookPayment(org: string, invoiceId: string, amount: number, userId: string, reason: "matched" | "unmatched") {
    const inv = await Invoice.findOne({ _id: invoiceId, org });
    if (!inv) return;
    // черновик и отменённый счёт деньгами не закрывают: привязка остаётся просто пометкой
    if (!["sent", "overdue", "paid"].includes(String(inv.status))) return;
    const { paid, gross, full } = applyPayment(inv, amount);
    inv.paidAmount = paid;
    inv.status = statusAfterPayment(String(inv.status), full);
    if (full) inv.paidAt = new Date();
    await inv.save();
    await logAudit({
        org, userId, action: reason === "matched" ? "invoice.payment_booked" : "invoice.payment_reverted",
        entityType: "invoice", entityId: String(inv._id),
        summary: `Invoice ${inv.number}: ${reason === "matched" ? "payment" : "payment removed"} ${amount} ${inv.currency} from the bank statement — ${paid} of ${gross}`,
        meta: { amount, paid, gross, currency: inv.currency },
    });
}
