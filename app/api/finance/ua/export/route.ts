import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { incomeBook, profitReport, vatRegister } from "@/lib/finance/ua";
import { paymentCalendar } from "@/lib/finance/ua/calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/finance/ua/export?kind=…&year=…&format=csv|xml — файл для кабинета ДПС.
//
// Публичного API у ДПС нет: подача идёт через кабинет (или M.E.Doc/Вчасно) с КЕП владельца.
// Поэтому первый этап — честный экспорт данных: CSV для таблиц и XML с теми же строками для
// загрузки в кабинет. Файл формируется из тех же отчётов, что видно на экране, и не является
// официальной формой декларации — формат перед подачей проверяет бухгалтер (в ТЗ помечено [проверить]).
//
// kind: income-book (книга доходів ФОП) · vat-register (реєстр ПН) · profit (податок на прибуток)
//       · calendar (календар платежів)

const KINDS = ["income-book", "vat-register", "profit", "calendar"] as const;

const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (rows: Array<Array<string | number>>) => "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
const xmlEsc = (v: unknown) => String(v ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c);
const xmlRows = (root: string, rows: Array<Record<string, string | number>>) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<${root}>\n${rows
        .map((r) => `  <row>${Object.entries(r).map(([k, v]) => `<${k}>${xmlEsc(typeof v === "number" ? v.toFixed(2) : v)}</${k}>`).join("")}</row>`)
        .join("\n")}\n</${root}>\n`;

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") as (typeof KINDS)[number] | null;
    if (!kind || !KINDS.includes(kind)) return badRequest("kind must be one of: " + KINDS.join(", "));
    const format = url.searchParams.get("format") === "xml" ? "xml" : "csv";
    const yearParam = url.searchParams.get("year");
    const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : String(new Date().getFullYear());
    // Период реестра ПН: месяц (YYYY-MM), конкретные даты (from/to) или весь год. Экран «ПДВ» показывает
    // месяц/квартал/год, поэтому выгрузка обязана уметь тот же период — иначе файл не совпадает с таблицей
    const month = url.searchParams.get("month");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    await requireMarket(user.id, "UA");

    let body = "";
    let filename = `dps-${kind}-${year}.${format}`;

    if (kind === "income-book") {
        const book = await incomeBook(user.id, year);
        const rows = book.quarters.flatMap((q) => q.rows.map((r) => [r.date, r.number, r.customer, r.amount.toFixed(2)]));
        body = format === "csv"
            ? csv([["Дата оплати", "Номер рахунку", "Контрагент", "Сума, грн"], ...rows, [], ["Дохід за рік", "", "", book.income.toFixed(2)]])
            : xmlRows("incomeBook", book.quarters.flatMap((q) => q.rows.map((r) => ({ date: r.date, invoice: r.number, customer: r.customer, amount: r.amount }))));
    } else if (kind === "vat-register") {
        // Границы периода: явные даты важнее месяца, месяц важнее года
        const DATE = /^\d{4}-\d{2}-\d{2}$/;
        const explicit = fromParam && DATE.test(fromParam) && toParam && DATE.test(toParam) && fromParam <= toParam;
        const from = explicit ? fromParam! : month ? `${month}-01` : `${year}-01-01`;
        const to = explicit ? toParam! : month ? new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10) : `${year}-12-31`;
        const reg = await vatRegister(user.id, from, to);
        filename = explicit ? `dps-vat-${from}_${to}.${format}` : month ? `dps-vat-${month}.${format}` : `dps-vat-${year}.${format}`;
        const issued = reg.issued.map((r) => ["issued", r.date, r.number, r.counterparty, r.net.toFixed(2), r.rate, r.tax.toFixed(2)]);
        const received = reg.received.map((r) => ["received", r.date, r.number, r.counterparty, r.net.toFixed(2), r.rate, r.tax.toFixed(2)]);
        body = format === "csv"
            ? csv([["Тип", "Дата", "Номер ПН", "Контрагент", "Без ПДВ", "Ставка", "ПДВ"], ...issued, ...received, [], ["До сплати", "", "", "", "", "", reg.payable.toFixed(2)]])
            : xmlRows("vatRegister", [...reg.issued.map((r) => ({ type: "issued", date: r.date, number: r.number, counterparty: r.counterparty, net: r.net, rate: r.rate, tax: r.tax })), ...reg.received.map((r) => ({ type: "received", date: r.date, number: r.number, counterparty: r.counterparty, net: r.net, rate: r.rate, tax: r.tax }))]);
    } else if (kind === "profit") {
        const report = await profitReport(user.id, year);
        body = format === "csv"
            ? csv([["Показник", "Сума, грн"], ["Дохід", report.income.toFixed(2)], ["Витрати", report.expenses.toFixed(2)], ["Амортизація", report.depreciation.toFixed(2)], ["Прибуток", report.profit.toFixed(2)], [`Податок (${report.rate} %)`, report.tax.toFixed(2)]])
            : xmlRows("profitReport", [{ income: report.income, expenses: report.expenses, depreciation: report.depreciation, profit: report.profit, rate: report.rate, tax: report.tax }]);
    } else {
        const book = await incomeBook(user.id, year);
        const entries = paymentCalendar(Number(year), book.profile, book.quarters);
        body = format === "csv"
            ? csv([["Дата", "Платіж", "Сума, грн", "Примітка"], ...entries.map((e) => [e.date, e.title, e.amount.toFixed(2), e.note])])
            : xmlRows("paymentCalendar", entries.map((e) => ({ date: e.date, title: e.title, amount: e.amount, kind: e.kind })));
    }

    return new NextResponse(body, {
        headers: {
            "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/xml; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    });
}
