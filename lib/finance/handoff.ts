import { prisma } from "@/lib/prisma";
import { marketOf } from "./market";
import { issuedExportCsv, receivedExportCsv } from "./esf";
import { makeZip } from "@/lib/zip";

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
    const files: { name: string; data: string }[] = [
        { name: "invoices.csv", data: csv([["number", "kind", "issue_date", "due_date", "customer", "customer_tax_id", "currency", "status", "paid_amount", "review"], ...invoices.map((i) => [i.number, i.kind, i.issueDate, i.dueDate, i.customerName, i.customerTaxId, i.currency, i.status, i.paidAmount, (i.review as { status?: string } | null)?.status ?? ""])]) },
        { name: "expenses.csv", data: csv([["date", "vendor", "category", "amount", "currency", "has_receipt", "review"], ...expenses.map((e) => [e.date, e.vendor, (e as { category?: string }).category ?? "", e.amount, e.currency, e.receipt ? "yes" : "no", (e.review as { status?: string } | null)?.status ?? ""])]) },
        { name: "bank.csv", data: csv([["date", "account", "amount", "currency", "counterparty", "reference", "matched"], ...bank.map((b) => [b.date, b.account, b.amount, b.currency, b.counterparty, b.reference, b.matchType ? "yes" : "no"])]) },
    ];
    if (marketOf(settings?.country) === "UZ") {
        files.push({ name: "esf-issued.csv", data: await issuedExportCsv(org, from, to) }, { name: "esf-received.csv", data: await receivedExportCsv(org, from, to) });
    }
    files.push({ name: "README.txt", data: `Firmspace handoff ${from} – ${to}\r\nCSV registers of the company data. Not a tax return and not a signed document.\r\n` });
    return makeZip(files);
}
