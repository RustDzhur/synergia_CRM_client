import { NextResponse } from "next/server";
import { PLANS, YEAR_MONTHS } from "@/app/config/plans";
import { requirePlatformAdmin } from "@/lib/admin";
import { effectivePlan } from "@/lib/billing";
import InvoiceRequest from "@/models/InvoiceRequest";
import Organization from "@/models/Organization";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/admin/summary — сводка для администратора платформы: фирмы по тарифам, оценка месячной выручки, новые запросы счёта
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const orgs = await Organization.find({}).select("plan planOverride planOverrideUntil billing blocked");
    const byPlan: Record<string, number> = { free: 0, standard: 0, professional: 0 };
    let mrr = 0;
    for (const o of orgs) {
        byPlan[effectivePlan(o)] = (byPlan[effectivePlan(o)] ?? 0) + 1;
        // выручку считаем только по действующим подпискам Stripe (ручные назначения — не деньги); год приводится к месяцу
        if (["active", "trialing", "past_due"].includes(o.billing?.status ?? "") && ["standard", "professional"].includes(o.plan)) {
            const price = PLANS.find((p) => p.id === o.plan)?.priceMonth ?? 0;
            mrr += o.billing?.interval === "year" ? (price * YEAR_MONTHS) / 12 : price;
        }
    }
    return NextResponse.json({
        orgs: orgs.length,
        users: await User.countDocuments({}),
        byPlan,
        mrr: Math.round(mrr * 100) / 100,
        blocked: orgs.filter((o) => o.blocked).length,
        newRequests: await InvoiceRequest.countDocuments({ status: "new" }),
    });
}
