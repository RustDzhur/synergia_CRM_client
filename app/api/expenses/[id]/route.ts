import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { withPeriodLock } from "@/lib/finance/periodLock";
import { financeSettings } from "@/lib/finance/settings";
import { loadExpenseCategories } from "@/lib/finance/expenseCatalogDb";
import { ExpenseInputError, manualFieldsAfterPatch, parseExpenseFields } from "@/lib/finance/expenseInput";
import { toExpenseDTO } from "@/lib/finance/expenseDto";
import type { DatevChart } from "@/lib/finance/expenseCatalog";

async function handleDELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const expense = await prisma.expense.findFirst({ where: { id: params.id, org: user.id } });
    if (!expense) return notFound();
    await prisma.expense.deleteMany({ where: { id: expense.id } });
    await logAudit({ org: user.id, userId: user.userId, action: "expense.deleted", entityType: "expense", entityId: params.id, summary: `Expense ${expense.vendor} — ${expense.amount} ${expense.currency} — deleted`, meta: { amount: expense.amount, currency: expense.currency } });
    return NextResponse.json({ ok: true });
}

// PATCH /api/expenses/:id — налоговые поля Beleg (Steuerliche Angaben) и отметка ЭСФ.
// Ручная правка записывается в manualFields: автоопределение больше не перекрывает эти поля.
// Отметка ЭСФ { esf: { number, date, supplierInn } } остаётся совместимой: null снимает отметку.
async function handlePATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b)) return badRequest("Nothing to update");
    const body = b as Record<string, unknown>;
    const expense = await prisma.expense.findFirst({ where: { id: params.id, org: user.id } });
    if (!expense) return notFound();

    const settings = await financeSettings(user.id);
    const chart: DatevChart = settings.datevChart === "SKR04" ? "SKR04" : "SKR03";
    const { entries } = await loadExpenseCategories();
    let parsed;
    try {
        parsed = parseExpenseFields(body, { chart, categories: entries, mode: "patch", currentTaxRate: expense.taxRate });
    } catch (e) {
        if (e instanceof ExpenseInputError) return badRequest(e.message);
        throw e;
    }

    if (parsed.date !== undefined && !parsed.date) return badRequest("documentDate is required");

    // Какие из присланных полей человек действительно менял (производные от категории — не в счёт)
    const explicit: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
        const direct =
            key === "date" ? "date" in body || "documentDate" in body
            : key === "paidDate" ? "paidDate" in body || "paymentDate" in body
            : key === "vendorVatId" ? "vendorVatId" in body || "vatId" in body
            : key === "vendorIban" ? "vendorIban" in body || "iban" in body
            : key === "category" ? "category" in body
            : key === "categoryCode" ? "categoryCode" in body || "subcategory" in body
            : key === "subcategory" ? "subcategory" in body
            : key === "taxRate" ? "taxRate" in body || "ustRate" in body || "vatRate" in body
            : key === "datevChart" ? "datevChart" in body
            : key in body;
        if (direct) explicit[key] = value;
    }
    const manualFields = manualFieldsAfterPatch(expense, explicit as never);
    const manualChanged = manualFields.length > (Array.isArray(expense.manualFields) ? expense.manualFields.length : 0);

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
        // datevChart без явного выбора не трогаем: это настройка фирмы, а не данные документа
        if (key === "datevChart" && !("datevChart" in body)) continue;
        data[key] = value;
    }
    // amount — совместимая нетто-сумма для старых отчётов
    if (parsed.netAmount !== undefined) data.amount = parsed.netAmount;
    if (parsed.reviewStatus !== undefined) data.reviewStatus = parsed.reviewStatus;
    else if (manualChanged) data.reviewStatus = "REVIEW";
    if (manualChanged) data.manualFields = manualFields;

    // Отметка ЭСФ (рынок UZ) — отдельная свободная отметка, разрешена и в закрытом периоде
    if ("esf" in body) {
        const t = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");
        const raw = body.esf as { number?: unknown; date?: unknown; supplierInn?: unknown } | null;
        const esf = raw && typeof raw === "object" ? { number: t(raw.number, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.date ?? "")) ? String(raw.date) : "", supplierInn: t(raw.supplierInn, 20) } : null;
        data.esf = (esf && esf.number ? esf : null) as never;
    }

    const hasTaxChange = Object.keys(data).some((k) => k !== "esf" && k !== "reviewStatus" && k !== "manualFields");
    if (!hasTaxChange && data.reviewStatus === undefined && data.esf === undefined && !("esf" in body)) {
        // Прислали только пустые/неизменившиеся значения — не плодим пустой UPDATE в закрытом периоде
        if (!Object.keys(explicit).length) return badRequest("Nothing to update");
    }
    const updated = Object.keys(data).length ? await prisma.expense.update({ where: { id: expense.id }, data }) : expense;
    await logAudit({
        org: user.id, userId: user.userId, action: "expense.updated", entityType: "expense", entityId: expense.id,
        summary: `Expense ${expense.vendor} — ${expense.amount} ${expense.currency} — updated`,
        meta: { fields: Object.keys(data).filter((k) => !["manualFields", "reviewStatus"].includes(k)).slice(0, 30), reviewStatus: updated.reviewStatus },
    });
    return NextResponse.json(toExpenseDTO(updated));
}

// Закрытый период (сторож в lib/prisma.ts) отвечает здесь 423, а не «Server error»
export const DELETE = withPeriodLock(handleDELETE);
export const PATCH = withPeriodLock(handlePATCH);
