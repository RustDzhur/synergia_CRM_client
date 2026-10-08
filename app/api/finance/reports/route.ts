import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { type PeriodKind, businessAnalysis, incomeSurplus, periodRange, trialBalance, vatReturn } from "@/lib/finance/reports";
import { incomeBook, profitReport, vatRegister } from "@/lib/finance/ua";
import { uzVatReport } from "@/lib/finance/uz";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";

// vat/eur/bwa/susa — немецкая отчётность; income-book и vat-register — украинская (см. lib/finance/ua.ts)
const KINDS = ["vat", "eur", "bwa", "susa", "income-book", "vat-register", "profit-report", "uz-vat"] as const;
type Kind = (typeof KINDS)[number];
const PERIODS: PeriodKind[] = ["month", "quarter", "year"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/finance/reports?kind=vat|eur|bwa|susa&period=month|quarter|year[&from=&to=]
// Отчёты для налоговой и для себя. Период можно задать явными датами или одним из готовых вариантов.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);

    const kind = url.searchParams.get("kind") as Kind | null;
    if (!kind || !KINDS.includes(kind)) return badRequest("kind must be one of: vat, eur, bwa, susa, income-book, vat-register, profit-report, uz-vat");

    // Режим рынка: немецкая отчётность не показывается украинской фирме и наоборот (ТЗ §3).
    // vat-register и income-book — украинские виды, остальные четыре — немецкие.
    // отказ по режиму рынка — 409 с кодом market, а не 500 от исключения
    try { await requireMarket(user.id, ["income-book", "vat-register", "profit-report"].includes(kind) ? "UA" : kind === "uz-vat" ? "UZ" : "DE"); } catch (e) { return failure(e); }

    const periodParam = url.searchParams.get("period");
    const period: PeriodKind = PERIODS.includes(periodParam as PeriodKind) ? (periodParam as PeriodKind) : "quarter";
    const preset = periodRange(period);

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam && DATE.test(fromParam) ? fromParam : preset.from;
    const to = toParam && DATE.test(toParam) ? toParam : preset.to;
    if (from > to) return badRequest("from must not be after to");

    // Книга доходов считается за год: у ФОП отчётность по єдиному податку годовая, а кварталы — внутри
    if (kind === "income-book" || kind === "profit-report") {
        const yearParam = url.searchParams.get("year");
        const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : from.slice(0, 4);
            const report = kind === "income-book" ? await incomeBook(user.id, year) : await profitReport(user.id, year);
        return NextResponse.json({ period: "year", report });
    }

    const range = { from, to };
    if (kind === "uz-vat") return NextResponse.json({ period, report: await uzVatReport(user.id, range.from, range.to) });
    if (kind === "vat") return NextResponse.json({ period, report: await vatReturn(user.id, range.from, range.to) });
    if (kind === "eur") return NextResponse.json({ period, report: await incomeSurplus(user.id, range.from, range.to) });
    if (kind === "vat-register") return NextResponse.json({ period, report: await vatRegister(user.id, range.from, range.to) });
    if (kind === "bwa") return NextResponse.json({ period, report: await businessAnalysis(user.id, range.from, range.to) });
    return NextResponse.json({ period, report: await trialBalance(user.id, range.from, range.to) });
}
