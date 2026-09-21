import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { stripeConfigured } from "@/lib/stripe";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/billing — текущий тариф и подписка пользователя, и настроены ли платежи на сервере
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    await connectDB();
    const doc = await User.findById(user.id).select("plan billing");
    const b = doc?.billing;
    return NextResponse.json({
        configured: stripeConfigured(),
        plan: doc?.plan ?? "free",
        status: b?.status ?? "",
        interval: b?.interval ?? "",
        currentPeriodEnd: b?.currentPeriodEnd ? b.currentPeriodEnd.toISOString() : "",
        cancelAtPeriodEnd: !!b?.cancelAtPeriodEnd,
        hasCustomer: !!b?.customerId,
    });
}
