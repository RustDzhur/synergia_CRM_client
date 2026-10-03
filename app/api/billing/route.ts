import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { effectivePlan } from "@/lib/billing";
import { amountsFor, currencyOf, getRequisites, listOrders, marketForOrg, readiness } from "@/lib/transferPay";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/billing?locale= — текущий тариф фирмы и как её можно оплатить: рынок (Германия/Украина), валюта, цены и доступные способы
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const locale = new URL(req.url).searchParams.get("locale") ?? undefined;
    const [doc, market, r, open] = await Promise.all([
        prisma.organization.findUnique({ where: { id: user.id }, select: { plan: true, planOverride: true, planOverrideUntil: true } }),
        marketForOrg(user.id, locale),
        getRequisites(),
        listOrders(user.id, ["new", "claimed"]),
    ]);
    const price = (plan: "standard" | "professional") => ({ month: amountsFor(r, market, plan, "month").amount, year: amountsFor(r, market, plan, "year").amount });
    return NextResponse.json({
        plan: doc ? effectivePlan(doc as never) : "free",
        // тариф оплачен вперёд (или назначен администратором): действует до этой даты
        paidUntil: doc?.planOverride && doc.planOverrideUntil && doc.planOverrideUntil.getTime() > Date.now() ? doc.planOverrideUntil.toISOString() : "",
        market,
        currency: currencyOf(market),
        methods: readiness(r, market),
        prices: { standard: price("standard"), professional: price("professional") },
        open: open.map((o) => ({ id: o.id, number: o.number, plan: o.plan, interval: o.interval, method: o.method, status: o.status })),
    });
}
