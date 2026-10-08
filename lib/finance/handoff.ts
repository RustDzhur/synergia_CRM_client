import { prisma } from "@/lib/prisma";
import { marketOf } from "./market";
import { issuedExportCsv, receivedExportCsv } from "./esf";
import { makeZip } from "@/lib/zip";
import { datevCsv } from "./datev";
import { incomeBook, vatRegister } from "./ua";
import { invoicePdfBuffer, pdfLocale } from "./document";

// Пакет «отдать бухгалтеру»: CSV-реестры за период одним архивом. Только выгрузка данных фирмы — ничего не отправляется и не подписывается.
// DATEV-выгрузка (Германия) остаётся в /api/export?kind=datev: её формат подтверждает бухгалтер.
const cell = (v: unknown) => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

export async function handoffZip(org: string, from: string, to: string): Promise<Buffer> {
    const [settings, invoices, expenses, bank] = await Promise.all([
        prisma.financeSettings.findUnique({ where: { org }, select: { country: true } }),
        prisma.invoice.findMany({ where: { org, status: { not: "draft" }, issueDate: { gte: from, lte: to } }, orderBy: [{ issueDate: "asc" }, { number: "asc" }] }),
        prisma.expense.findMany({ where: { org, date: { gte: from, lte: to } }, orderBy: { date: "asc" } }),
        prisma.bankTransaction.findMany({ where: { org, date: { gte: from, lte: to } }, orderBy: { date: "asc" } }),
    ]);
    const files: { name: string; data: string | Uint8Array }[] = [
        { name: "invoices.csv", data: csv([["number", "kind", "issue_date", "due_date", "customer", "customer_tax_id", "currency", "status", "paid_amount", "review"], ...invoices.map((i) => [i.number, i.kind, i.issueDate, i.dueDate, i.customerName, i.customerTaxId, i.currency, i.status, i.paidAmount, (i.review as { status?: string } | null)?.status ?? ""])]) },
        { name: "expenses.csv", data: csv([["date", "vendor", "category", "amount", "currency", "has_receipt", "review"], ...expenses.map((e) => [e.date, e.vendor, (e as { category?: string }).category ?? "", e.amount, e.currency, e.receipt ? "yes" : "no", (e.review as { status?: string } | null)?.status ?? ""])]) },
        { name: "bank.csv", data: csv([["date", "account", "amount", "currency", "counterparty", "reference", "matched"], ...bank.map((b) => [b.date, b.account, b.amount, b.currency, b.counterparty, b.reference, b.matchType ? "yes" : "no"])]) },
    ];
    if (marketOf(settings?.country) === "UZ") {
        files.push({ name: "esf-issued.csv", data: await issuedExportCsv(org, from, to) }, { name: "esf-received.csv", data: await receivedExportCsv(org, from, to) });
    }
    // реестры по режиму рынка (docs/TZ_MASTER.md §5.2 п. 8): DATEV для DE, книга доходов и реестр ПН для UA
    const market = marketOf(settings?.country);
    const year = to.slice(0, 4);
    if (market === "DE") files.push({ name: `EXTF_Buchungsstapel_${year}.csv`, data: await datevCsv(org, { year, revenueAccount: "8400", bankAccount: "1200" }) });
    if (market === "UA") {
        const book = await incomeBook(org, year);
        files.push({ name: `income-book-${year}.csv`, data: csv([["date", "number", "customer", "amount"], ...book.quarters.flatMap((q) => q.rows.map((r) => [r.date, r.number, r.customer, r.amount.toFixed(2)]))]) });
        const reg = await vatRegister(org, from, to);
        files.push({ name: "vat-register.csv", data: csv([["side", "date", "number", "counterparty", "net", "tax", "gross", "rate"], ...reg.issued.map((r) => ["issued", r.date, r.number, r.counterparty, r.net, r.tax, r.gross, r.rate]), ...reg.received.map((r) => ["received", r.date, r.number, r.counterparty, r.net, r.tax, r.gross, r.rate])]) });
    }
    // PDF выставленных счетов за период (до 200 штук, чтобы архив не разрастался)
    const sent = invoices.filter((i) => i.status !== "cancelled").slice(0, 200);
    for (const inv of sent) {
        try {
            const pdf = await invoicePdfBuffer(org, inv, pdfLocale(null));
            files.push({ name: `documents/${String(inv.number).replace(/[^\w.-]+/g, "_")}.pdf`, data: pdf as unknown as Uint8Array });
        } catch { /* одна неудачная печатная форма не должна ломать весь пакет */ }
    }
    files.push({ name: "README.txt", data: `Firmspace handoff ${from} – ${to}\r\nCSV registers of the company data. Not a tax return and not a signed document.\r\n` });
    return makeZip(files);
}
