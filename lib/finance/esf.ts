import { prisma } from "@/lib/prisma";
import { financeSettings } from "./settings";
import { computeTotals } from "./totals";
import type { UzProfile } from "@/lib/validation/uz";

// Электронный счёт-фактура (ЭСФ) Узбекистана — версия 1: система готовит ДАННЫЕ и проверяет полноту, но не отправляет
// их оператору (нет договора и API; docs/TZ_MASTER.md §4.2 п. 5). Юридически значимый ЭСФ создаётся только у оператора с ЭЦП;
// печатная форма «не является ЭСФ». Реквизиты — по Положению о счетах-фактурах 2020 г. (список в docs/TZ_UZBEKISTAN_AND_ROBOTS.md,
// раздел 7.2): все пункты помечены «проверить по официальному тексту», поэтому проверки показываются как подсказки специалисту.

export type EsfSeverity = "error" | "warning";
export interface EsfIssue { code: string; severity: EsfSeverity; params?: Record<string, string | number> }

export const ESF_STATUSES = ["none", "prepared", "sent", "confirmed", "cancelled"] as const;
export type EsfStatus = (typeof ESF_STATUSES)[number];
export interface EsfMark { status: EsfStatus; number?: string; at?: string; operator?: string }

export const cleanEsfMark = (v: unknown): EsfMark | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const status = (ESF_STATUSES as readonly string[]).includes(String(o.status)) ? (o.status as EsfStatus) : "none";
    const t = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/[\p{Cc}<>]/gu, " ").trim().slice(0, max) : "");
    return { status, number: t(o.number, 60), at: /^\d{4}-\d{2}-\d{2}$/.test(String(o.at ?? "")) ? String(o.at) : "", operator: t(o.operator, 60) };
};

interface Item { description?: string; qty?: number; unitPrice?: number; taxRate?: number; unit?: string }
export interface EsfInvoice {
    number: string; kind: string; issueDate: string; supplyDate?: string; currency: string; customerName: string; customerTaxId?: string; customerAddress?: string;
    items?: Item[]; rate?: { value?: number } | null; contract?: string | null; order?: string | null; esf?: unknown;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Проверка полноты данных документа для ЭСФ. error — без этого ЭСФ не выписать; warning — стоит проверить. */
export function esfIssues(inv: EsfInvoice, seller: { legalName?: string; address?: string }, uz: Partial<UzProfile>): EsfIssue[] {
    const out: EsfIssue[] = [];
    const e = (code: string, params?: Record<string, string | number>) => out.push({ code, severity: "error", params });
    const w = (code: string, params?: Record<string, string | number>) => out.push({ code, severity: "warning", params });
    if (!seller.legalName) e("seller_name");
    if (!seller.address) e("seller_address");
    if (!uz.inn && !uz.pinfl) e("seller_inn");
    if (uz.vatPayer !== true) w("seller_not_vat_payer");
    else if (!uz.vatCode) e("seller_vat_code");
    if (!uz.bank || !uz.mfo || !uz.account) e("seller_bank");
    if (!inv.customerName?.trim()) e("buyer_name");
    if (!inv.customerTaxId?.trim()) e("buyer_inn");
    if (!inv.customerAddress?.trim()) w("buyer_address");
    if (!inv.supplyDate) w("supply_date");
    if (!inv.contract && !inv.order) w("basis_document");
    const items = inv.items ?? [];
    if (!items.length) e("items_empty");
    items.forEach((it, i) => {
        if (!String(it.description ?? "").trim()) e("item_name", { n: i + 1 });
        if (!String(it.unit ?? "").trim()) e("item_unit", { n: i + 1 });
        if (!(Number(it.qty) > 0)) e("item_qty", { n: i + 1 });
        if (!(Number(it.unitPrice) >= 0) || it.unitPrice === undefined) e("item_price", { n: i + 1 });
        if (it.taxRate === undefined || it.taxRate === null) e("item_vat_rate", { n: i + 1 });
    });
    // Счёт-фактура выставляется в сумах: валютный документ должен иметь зафиксированный курс ЦБ
    if (String(inv.currency).toUpperCase() !== "UZS" && !(Number(inv.rate?.value) > 0)) e("currency_rate", { currency: inv.currency });
    if (!uz.director) w("signer_director");
    if (!uz.accountant) w("signer_accountant");
    return out;
}

/** Сумма документа в сумах: у валютного — по снимку курса ЦБ; без курса null. */
export function toUzs(amount: number, currency: string, rate?: { value?: number } | null): number | null {
    if (String(currency).toUpperCase() === "UZS") return round(amount);
    const r = Number(rate?.value);
    return r > 0 ? round(amount * r) : null;
}

export interface EsfRow {
    id: string; number: string; kind: string; date: string; supplyDate: string; customer: string; customerInn: string;
    net: number | null; tax: number | null; gross: number | null; currency: string;
    mark: EsfMark; errors: number; warnings: number; issues: EsfIssue[];
}

const rowOf = (inv: EsfInvoice & { id: string }, seller: { legalName?: string; address?: string }, uz: Partial<UzProfile>): EsfRow => {
    const items = (inv.items ?? []).map((it) => ({ qty: Number(it.qty) || 0, unitPrice: Number(it.unitPrice) || 0, taxRate: Number(it.taxRate) || 0 }));
    const t = computeTotals(items);
    const sign = inv.kind === "credit_note" ? -1 : 1;
    const issues = esfIssues(inv, seller, uz);
    return {
        id: inv.id, number: inv.number, kind: inv.kind, date: inv.issueDate, supplyDate: inv.supplyDate ?? "", customer: inv.customerName, customerInn: inv.customerTaxId ?? "",
        net: toUzs(sign * t.net, inv.currency, inv.rate), tax: toUzs(sign * t.tax, inv.currency, inv.rate), gross: toUzs(sign * t.gross, inv.currency, inv.rate),
        currency: inv.currency, mark: cleanEsfMark(inv.esf) ?? { status: "none" },
        errors: issues.filter((i) => i.severity === "error").length, warnings: issues.filter((i) => i.severity === "warning").length, issues,
    };
};

export interface IssuedRegister { from: string; to: string; rows: EsfRow[]; totals: { net: number; tax: number; gross: number }; notReady: number; notSent: number }

/** Журнал выданных счетов-фактур за период (счета и корректировки, кроме черновиков и отменённых). */
export async function issuedRegister(org: string, from: string, to: string): Promise<IssuedRegister> {
    const [settings, list] = await Promise.all([
        financeSettings(org),
        prisma.invoice.findMany({ where: { org, status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: from, lte: to } }, orderBy: [{ issueDate: "asc" }, { number: "asc" }] }),
    ]);
    const uz = ((settings as { uz?: unknown }).uz ?? {}) as Partial<UzProfile>;
    const rows = list.map((inv) => rowOf(inv as never, { legalName: settings.legalName, address: settings.address }, uz));
    const sum = (k: "net" | "tax" | "gross") => round(rows.reduce((s, r) => s + (r[k] ?? 0), 0));
    return { from, to, rows, totals: { net: sum("net"), tax: sum("tax"), gross: sum("gross") }, notReady: rows.filter((r) => r.errors > 0).length, notSent: rows.filter((r) => r.mark.status === "none" || r.mark.status === "prepared").length };
}

export interface ReceivedRow { id: string; date: string; vendor: string; supplierInn: string; esfNumber: string; esfDate: string; net: number; vat: number; currency: string; hasEsf: boolean }
export interface ReceivedRegister { from: string; to: string; rows: ReceivedRow[]; totals: { net: number; vat: number; withoutEsfVat: number } }

/** Журнал полученных счетов-фактур: расходы периода с отметкой полученного ЭСФ. Без ЭСФ входной QQS не принимается к зачёту (правило проверяет специалист). */
export async function receivedRegister(org: string, from: string, to: string): Promise<ReceivedRegister> {
    const list = await prisma.expense.findMany({ where: { org, date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
    const rows: ReceivedRow[] = list.map((e) => {
        const esf = (e.esf && typeof e.esf === "object" ? e.esf : {}) as { number?: string; date?: string; supplierInn?: string };
        const vat = round((Number(e.amount) || 0) * ((Number(e.taxRate) || 0) / 100));
        return { id: e.id, date: e.date, vendor: e.vendor, supplierInn: esf.supplierInn ?? "", esfNumber: esf.number ?? "", esfDate: esf.date ?? "", net: round(Number(e.amount) || 0), vat, currency: e.currency, hasEsf: !!esf.number };
    });
    return {
        from, to, rows,
        totals: { net: round(rows.reduce((s, r) => s + r.net, 0)), vat: round(rows.reduce((s, r) => s + r.vat, 0)), withoutEsfVat: round(rows.filter((r) => !r.hasEsf).reduce((s, r) => s + r.vat, 0)) },
    };
}

const csvCell = (v: unknown) => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";

/** Файл для загрузки/сверки в кабинете оператора: по строке на позицию документа, суммы в валюте документа и в сумах. */
export async function issuedExportCsv(org: string, from: string, to: string): Promise<string> {
    const [settings, list] = await Promise.all([
        financeSettings(org),
        prisma.invoice.findMany({ where: { org, status: { notIn: ["draft", "cancelled"] }, issueDate: { gte: from, lte: to } }, orderBy: [{ issueDate: "asc" }, { number: "asc" }] }),
    ]);
    const uz = ((settings as { uz?: unknown }).uz ?? {}) as Partial<UzProfile>;
    const head = ["number", "kind", "issue_date", "supply_date", "seller_name", "seller_inn", "seller_vat_code", "seller_bank", "seller_mfo", "seller_account", "buyer_name", "buyer_inn", "buyer_address", "line", "item_name", "unit", "qty", "price_excl_vat", "amount_excl_vat", "vat_rate", "vat_amount", "amount_incl_vat", "currency", "cbu_rate", "amount_incl_vat_uzs", "basis_contract"];
    const rows: unknown[][] = [head];
    for (const inv of list) {
        const sign = inv.kind === "credit_note" ? -1 : 1;
        const rate = (inv.rate && typeof inv.rate === "object" ? inv.rate : null) as { value?: number } | null;
        ((inv.items ?? []) as unknown as Item[]).forEach((it, i) => {
            const qty = Number(it.qty) || 0, price = Number(it.unitPrice) || 0, vr = Number(it.taxRate) || 0;
            const net = round(qty * price), vat = round(net * vr / 100), gross = round(net + vat);
            rows.push([inv.number, inv.kind, inv.issueDate, inv.supplyDate || inv.issueDate, settings.legalName, uz.inn || uz.pinfl || "", uz.vatCode || "", uz.bank || "", uz.mfo || "", uz.account || "",
                inv.customerName, inv.customerTaxId, inv.customerAddress, i + 1, it.description ?? "", it.unit ?? "", sign * qty, price, sign * net, vr, sign * vat, sign * gross, inv.currency, rate?.value ?? "",
                toUzs(sign * gross, inv.currency, rate) ?? "", inv.contract ?? ""]);
        });
    }
    return csv(rows);
}

export async function receivedExportCsv(org: string, from: string, to: string): Promise<string> {
    const reg = await receivedRegister(org, from, to);
    return csv([["date", "supplier", "supplier_inn", "esf_number", "esf_date", "amount_excl_vat", "vat", "currency"], ...reg.rows.map((r) => [r.date, r.vendor, r.supplierInn, r.esfNumber, r.esfDate, r.net, r.vat, r.currency])]);
}
