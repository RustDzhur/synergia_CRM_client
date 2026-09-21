import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requirePlatformAdmin } from "@/lib/admin";
import { failure, notFound, validId } from "@/lib/api";
import { applySubscription, type StripeSubscription } from "@/lib/billing";
import { stripe, stripeConfigured } from "@/lib/stripe";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

// POST /api/admin/orgs/:id/cancel — отменить подписку фирмы в Stripe в конце оплаченного периода
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    if (!stripeConfigured()) return NextResponse.json({ message: "Payments are not configured yet" }, { status: 503 });
    try {
        await connectDB();
        const org = await Organization.findById(params.id);
        if (!org?.billing?.subscriptionId) return NextResponse.json({ message: "No subscription" }, { status: 404 });
        const sub = await stripe<StripeSubscription>("POST", `/subscriptions/${org.billing.subscriptionId}`, { cancel_at_period_end: true });
        await applySubscription(sub);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
