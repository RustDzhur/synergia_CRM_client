import { NextResponse } from "next/server";
import { PLANS, YEAR_MONTHS } from "@/config/plans";
import { requirePlatformAdmin } from "@/lib/admin";
import { effectivePlan } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/summary — сводка для администратора платформы: фирмы по тарифам, оценка месячной выручки, новые запросы счёта
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const orgs = await prisma.organization.findMany({ select: { plan: true, planOverride: true, planOverrideUntil: true, billing: true, blocked: true } });
    const byPlan: Record<string, number> = { free: 0, standard: 0, professional: 0 };
    let mrr = 0;
    for (const o of orgs) {
        byPlan[effectivePlan(o as never)] = (byPlan[effectivePlan(o as never)] ?? 0) + 1;
        // выручку считаем только по действующим подпискам Stripe (ручные назначения — не деньги); год приводится к месяцу
        const billing = (o.billing ?? {}) as any;
        if (["active", "trialing", "past_due"].includes(billing.status ?? "") && ["standard", "professional"].includes(o.plan)) {
            const price = PLANS.find((p) => p.id === o.plan)?.priceMonth ?? 0;
            mrr += billing.interval === "year" ? (price * YEAR_MONTHS) / 12 : price;
        }
    }
    return NextResponse.json({
        orgs: orgs.length,
        users: await prisma.user.count(),
        byPlan,
        mrr: Math.round(mrr * 100) / 100,
        blocked: orgs.filter((o) => o.blocked).length,
        newRequests: await prisma.invoiceRequest.count({ where: { status: "new" } }),
    });
}
