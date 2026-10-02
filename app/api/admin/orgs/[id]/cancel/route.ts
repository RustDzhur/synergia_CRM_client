import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { failure, notFound, validId } from "@/lib/api";
import { type StripeSubscription, applySubscription } from "@/lib/billing";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/admin/orgs/:id/cancel — отменить подписку фирмы в Stripe в конце оплаченного периода
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    if (!stripeConfigured()) return NextResponse.json({ message: "Payments are not configured yet" }, { status: 503 });
    try {
        const org = await prisma.organization.findUnique({ where: { id: params.id } });
        const subscriptionId = (org?.billing as any)?.subscriptionId;
        if (!subscriptionId) return NextResponse.json({ message: "No subscription" }, { status: 404 });
        const sub = await stripe<StripeSubscription>("POST", `/subscriptions/${subscriptionId}`, { cancel_at_period_end: true });
        await applySubscription(sub);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
