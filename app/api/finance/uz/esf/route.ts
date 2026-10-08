import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { requireMarket } from "@/lib/finance/marketGuard";
import { issuedRegister, receivedRegister } from "@/lib/finance/esf";
import { periodRange, type PeriodKind } from "@/lib/finance/reports";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS: PeriodKind[] = ["month", "quarter", "year"];

// GET /api/finance/uz/esf?kind=issued|received&period=month|quarter|year[&from=&to=] — журналы счетов-фактур рынка UZ.
// Журналы готовят данные для кабинета оператора ЭСФ; сама система ничего оператору не отправляет (docs/UZBEKISTAN.md).
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try { await requireMarket(user.id, "UZ"); } catch (e) { return failure(e); }
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") === "received" ? "received" : "issued";
    const p = url.searchParams.get("period") as PeriodKind;
    const preset = periodRange(PERIODS.includes(p) ? p : "month");
    const f = url.searchParams.get("from"), t = url.searchParams.get("to");
    const from = f && DATE.test(f) ? f : preset.from, to = t && DATE.test(t) ? t : preset.to;
    if (from > to) return badRequest("from must not be after to");
    return NextResponse.json(kind === "issued" ? { kind, register: await issuedRegister(user.id, from, to) } : { kind, register: await receivedRegister(user.id, from, to) });
}
