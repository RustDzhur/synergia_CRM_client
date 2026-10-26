import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { ownedDeal } from "@/lib/deals";
import { emit } from "@/lib/automation/emit";
import { logActivity } from "@/lib/sync/feed";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { defaultCurrency, financeSettings } from "@/lib/finance/settings";
import { fx } from "@/lib/sync/texts";
import { withPeriodLock } from "@/lib/finance/periodLock";
import { loadExpenseCategories } from "@/lib/finance/expenseCatalogDb";
import { parseExpenseFields, ExpenseInputError } from "@/lib/finance/expenseInput";
import { toExpenseDTO } from "@/lib/finance/expenseDto";
import type { DatevChart } from "@/lib/finance/expenseCatalog";

export const dynamic = "force-dynamic";

// GET /api/expenses?from=&to=&category=&status=&vat=&q= — расходы фирмы за период (по умолчанию — все),
// самые новые первыми. Налоговые фильтры работают на сервере, чтобы список не тянул всю историю.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const where: Record<string, unknown> = { org: user.id };
    const from = url.searchParams.get("from"); const to = url.searchParams.get("to");
    if (from || to) where.date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const category = url.searchParams.get("category");
    if (category) where.categoryCode = category;
    const status = url.searchParams.get("status");
    if (status && ["AUTO", "REVIEW", "OK"].includes(status)) where.reviewStatus = status;
    const vat = url.searchParams.get("vat");
    if (vat === "yes") where.inputVatDeductible = true;
    if (vat === "no") where.inputVatDeductible = false;
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q) where.OR = [{ vendor: { contains: q, mode: "insensitive" } }, { documentNumber: { contains: q, mode: "insensitive" } }];
    const list = await prisma.expense.findMany({ where: where as any, orderBy: { date: "desc" }, take: 500 });
    return NextResponse.json(list.map(toExpenseDTO));
}

// POST /api/expenses
async function handlePOST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);

    const settings = await financeSettings(user.id);
    const chart: DatevChart = settings.datevChart === "SKR04" ? "SKR04" : "SKR03";
    const { entries } = await loadExpenseCategories();
    let parsed;
    try {
        parsed = parseExpenseFields(b, { chart, categories: entries, mode: "create" });
    } catch (e) {
        if (e instanceof ExpenseInputError) return badRequest(e.message);
        throw e;
    }
    const vendor = parsed.vendor ?? "";
    if (!vendor) return badRequest("vendor is required");
    const netAmount = parsed.netAmount ?? 0;
    const grossAmount = parsed.grossAmount ?? netAmount;
    // Сумма обязательна, но ноль допустим (старый контракт: non-negative). Проверяем наличие поля,
    // а не величину: иначе `amount: 0` из платёжной выгрузки стал бы 400.
    const amountGiven = (!!b && typeof b === "object" && ["amount", "netAmount", "grossAmount"].some((k) => Object.prototype.hasOwnProperty.call(b, k))) || grossAmount > 0;
    if (!amountGiven) return badRequest("amount is required");
    const date = parsed.date || new Date().toISOString().slice(0, 10);

    // Ссылки на сделку, заказ и файл чека принимаются, только если они принадлежат этой фирме: чужой id привязать нельзя
    const [deal, order, receipt] = await Promise.all([
        b?.deal ? ownedDeal(String(b.deal), user.id) : null,
        b?.order && validId(String(b.order)) ? prisma.order.findFirst({ where: { id: String(b.order), org: user.id }, select: { id: true } }) : null,
        b?.receipt && validId(String(b.receipt)) ? prisma.docItem.findFirst({ where: { id: String(b.receipt), owner: user.id }, select: { id: true } }) : null,
    ]);
    if ((b?.deal && !deal) || (b?.order && !order) || (b?.receipt && !receipt)) return badRequest("deal, order or receipt not found");
    const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
    const expense = await prisma.expense.create({
        data: {
            org: user.id, vendor, amount: netAmount, date,
            category: parsed.category ?? "",
            categoryCode: parsed.categoryCode ?? "",
            subcategory: parsed.subcategory ?? "",
            taxRate: parsed.taxRate ?? 0,
            netAmount, grossAmount,
            vatAmount: parsed.vatAmount ?? 0,
            inputVatDeductible: parsed.inputVatDeductible ?? true,
            currency: parsed.currency || await defaultCurrency(user.id),
            datevAccount: parsed.datevAccount ?? "",
            datevChart: parsed.datevChart ?? chart,
            paidDate: parsed.paidDate ?? "",
            documentNumber: parsed.documentNumber ?? "",
            vendorVatId: parsed.vendorVatId ?? "",
            vendorIban: parsed.vendorIban ?? "",
            bookingKind: parsed.bookingKind ?? "Betriebsausgabe",
            afaYears: parsed.afaYears ?? null,
            afaResidualValue: parsed.afaResidualValue ?? null,
            folder: parsed.folder ?? "",
            reviewStatus: parsed.reviewStatus ?? "REVIEW",
            confidence: parsed.confidence ?? 0,
            deal: deal ?? undefined, order: order ? order.id : undefined, receipt: receipt ? receipt.id : undefined,
            recurring: ["monthly", "yearly"].includes(b?.recurring) ? b.recurring : "",
            notes: typeof b?.notes === "string" ? b.notes.trim().slice(0, 2000) : "",
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        },
    });
    await logAudit({
        org: user.id, userId: user.userId, action: "expense.created", entityType: "expense", entityId: expense.id,
        summary: `Expense ${expense.vendor} — ${expense.amount} ${expense.currency}`,
        meta: { amount: expense.amount, currency: expense.currency, categoryCode: expense.categoryCode, reviewStatus: expense.reviewStatus },
    });
    // расход по сделке виден в её ленте (и в ленте клиента сделки): иначе маржа сделки менялась бы незаметно
    if (expense.deal) {
        const d = await prisma.deal.findFirst({ where: { id: expense.deal, owner: user.id }, select: { id: true, contact: true, company: true } });
        if (d) await logActivity(user.id, { deal: d.id, contact: d.contact, company: d.company }, { type: "expense", text: fx("expense", { vendor: expense.vendor, amount: expense.amount, currency: expense.currency }), meta: `expense:${expense.id}`, key: `expense:${expense.id}` });
    }
    await emit(user.id, { type: "expense_created", data: { id: expense.id, vendor: expense.vendor, amount: String(expense.amount), currency: expense.currency, dealId: expense.deal ?? "" } });
    return NextResponse.json(toExpenseDTO(expense), { status: 201 });
}

// Закрытый период (сторож в lib/prisma.ts) отвечает здесь 423, а не «Server error»
export const POST = withPeriodLock(handlePOST);
