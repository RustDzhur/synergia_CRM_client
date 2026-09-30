import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { incomeBook } from "@/lib/finance/ua";
import { calendarSummary, paymentCalendar } from "@/lib/finance/ua/calendar";

export const dynamic = "force-dynamic";

// GET /api/finance/ua/calendar?year= — календарь платежей украинской фирмы: ЄСВ по месяцам, єдиний
// податок и военный сбор по кварталам (суммы — из книги доходов), ПДВ по периоду из настроек.
// Сроки — справочные: перед уплатой их подтверждает бухгалтер, в интерфейсе это сказано прямо.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    await requireMarket(user.id, "UA");
    const url = new URL(req.url);
    const yearParam = url.searchParams.get("year");
    const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : new Date().getFullYear();

    const book = await incomeBook(user.id, String(year));
    const entries = paymentCalendar(year, book.profile, book.quarters);
    return NextResponse.json({ year, profile: book.profile, entries, summary: calendarSummary(entries), rules: book.rules });
}
