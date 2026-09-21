import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { stripeConfigured } from "@/lib/stripe";
import { effectivePlan } from "@/lib/billing";
import { cryptoConfigured } from "@/lib/nowpayments";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

// GET /api/billing — текущий тариф и подписка пользователя, и настроены ли платежи на сервере
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const doc = await Organization.findById(user.id).select("plan planOverride planOverrideUntil billing");
    const b = doc?.billing;
    return NextResponse.json({
        configured: stripeConfigured(),
        crypto: cryptoConfigured(),
        // оплачено вперёд (криптой или назначено администратором): тариф действует до этой даты
        prepaidUntil: doc?.planOverride && doc.planOverrideUntil && doc.planOverrideUntil.getTime() > Date.now() ? doc.planOverrideUntil.toISOString() : "",
        plan: doc ? effectivePlan(doc) : "free",
        status: b?.status ?? "",
        interval: b?.interval ?? "",
        currentPeriodEnd: b?.currentPeriodEnd ? b.currentPeriodEnd.toISOString() : "",
        cancelAtPeriodEnd: !!b?.cancelAtPeriodEnd,
        hasCustomer: !!b?.customerId,
    });
}
