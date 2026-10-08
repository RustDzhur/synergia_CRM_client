import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { registeredMarkets } from "@/lib/finance/market";
import { taxRules } from "@/lib/finance/taxRules";

export const dynamic = "force-dynamic";

// GET /api/finance/tax-rules?market=UZ — налоговые правила рынка с датами, источниками и отметкой проверки.
// verified: true только когда КАЖДАЯ запись подтверждена специалистом; иначе интерфейс показывает плашку «Бета».
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const market = (new URL(req.url).searchParams.get("market") ?? "").toUpperCase();
    if (!registeredMarkets().includes(market)) return badRequest("Unknown market");
    const rules = await taxRules(market);
    return NextResponse.json({ market, verified: rules.length > 0 && rules.every((r) => !!r.verifiedBy), rules });
}
