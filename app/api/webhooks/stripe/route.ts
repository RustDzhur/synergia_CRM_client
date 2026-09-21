import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { applySubscription, type StripeSubscription } from "@/lib/billing";
import { stripe, verifyStripeSignature } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe — события Stripe. В кабинете Stripe (Developers → Webhooks) укажите этот адрес и события:
// checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,
// invoice.payment_failed. Подпись проверяется секретом STRIPE_WEBHOOK_SECRET.
export async function POST(req: Request) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    const raw = await req.text();
    if (!secret || !verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
        return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }
    let event: { type: string; data: { object: any } };
    try {
        event = JSON.parse(raw);
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    try {
        await connectDB();
        const obj = event.data.object;
        if (event.type.startsWith("customer.subscription.")) {
            await applySubscription(obj as StripeSubscription);
        } else if (event.type === "checkout.session.completed" || event.type === "invoice.payment_failed") {
            // в этих событиях нет полного состояния подписки — запрашиваем его у Stripe
            const subId = typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;
            if (subId) await applySubscription(await stripe<StripeSubscription>("GET", `/subscriptions/${subId}`));
        }
        return NextResponse.json({ received: true });
    } catch {
        return NextResponse.json({ message: "Processing failed" }, { status: 500 }); // Stripe повторит доставку
    }
}
