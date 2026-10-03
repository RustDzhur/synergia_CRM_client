import { NextResponse } from "next/server";
import { PLANS, YEAR_MONTHS } from "@/config/plans";
import { requirePlatformAdmin } from "@/lib/admin";
import { effectivePlan } from "@/lib/billing";
import { listOrders } from "@/lib/transferPay";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/summary — сводка для администратора платформы: фирмы по тарифам, оценка месячной выручки, счета, ждущие подтверждения
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const [orgs, orders] = await Promise.all([
        prisma.organization.findMany({ select: { id: true, plan: true, planOverride: true, planOverrideUntil: true, blocked: true } }),
        listOrders(),
    ]);
    const byPlan: Record<string, number> = { free: 0, standard: 0, professional: 0 };
    // Выручку считаем только по тарифам, за которые пришла оплата (подтверждённый счёт); выданные вручную — не деньги. Год приводится к месяцу.
    const paid = new Map<string, { plan: string; interval: string }>();
    for (const o of orders) if (o.status === "paid" && !paid.has(o.org)) paid.set(o.org, o);
    let mrr = 0;
    for (const o of orgs) {
        const plan = effectivePlan(o as never);
        byPlan[plan] = (byPlan[plan] ?? 0) + 1;
        const last = paid.get(o.id);
        if (last && last.plan === plan && plan !== "free") {
            const price = PLANS.find((p) => p.id === plan)?.priceMonth ?? 0;
            mrr += last.interval === "year" ? (price * YEAR_MONTHS) / 12 : price;
        }
    }
    return NextResponse.json({
        orgs: orgs.length,
        users: await prisma.user.count(),
        byPlan,
        mrr: Math.round(mrr * 100) / 100,
        blocked: orgs.filter((o) => o.blocked).length,
        newRequests: orders.filter((o) => o.status === "claimed").length,
    });
}
