import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { businessAnalysis, incomeSurplus, periodRange, trialBalance, vatReturn, type PeriodKind } from "@/lib/finance/reports";

export const dynamic = "force-dynamic";

const KINDS = ["vat", "eur", "bwa", "susa"] as const;
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
    if (!kind || !KINDS.includes(kind)) return badRequest("kind must be one of: vat, eur, bwa, susa");

    const periodParam = url.searchParams.get("period");
    const period: PeriodKind = PERIODS.includes(periodParam as PeriodKind) ? (periodParam as PeriodKind) : "quarter";
    const preset = periodRange(period);

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam && DATE.test(fromParam) ? fromParam : preset.from;
    const to = toParam && DATE.test(toParam) ? toParam : preset.to;
    if (from > to) return badRequest("from must not be after to");

    await connectDB();
    const range = { from, to };
    if (kind === "vat") return NextResponse.json({ period, report: await vatReturn(user.id, range.from, range.to) });
    if (kind === "eur") return NextResponse.json({ period, report: await incomeSurplus(user.id, range.from, range.to) });
    if (kind === "bwa") return NextResponse.json({ period, report: await businessAnalysis(user.id, range.from, range.to) });
    return NextResponse.json({ period, report: await trialBalance(user.id, range.from, range.to) });
}
