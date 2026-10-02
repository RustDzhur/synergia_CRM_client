import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { incomeBook, vatRegister } from "@/lib/finance/ua";
import { calendarSummary, paymentCalendar } from "@/lib/finance/ua/calendar";

export const dynamic = "force-dynamic";

// GET /api/finance/ua/calendar?year= — календарь платежей украинской фирмы: ЄСВ по месяцам, єдиний
// податок и военный сбор по кварталам (суммы — из книги доходов), ПДВ — из реестра налоговых
// накладных за тот же период (выпущенные минус полученные). Сроки — справочные: перед уплатой
// их подтверждает бухгалтер, в интерфейсе это сказано прямо.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await requireMarket(user.id, "UA");
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getFullYear();

    const book = await incomeBook(user.id, String(year));
    // Реестр ПН за год — один запрос: месячные и квартальные сроки раскидывает сам календарь
    const reg = book.profile.vatPayer ? await vatRegister(user.id, `${year}-01-01`, `${year}-12-31`) : null;
    const vatRows = reg
        ? [...reg.issued.map((r) => ({ date: r.date, tax: r.tax })), ...reg.received.map((r) => ({ date: r.date, tax: -r.tax }))]
        : [];
    const entries = paymentCalendar(year, book.profile, book.quarters, vatRows);
    return NextResponse.json({ year, profile: book.profile, entries, summary: calendarSummary(entries), rules: book.rules });
}
