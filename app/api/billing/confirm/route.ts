import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { applySubscription, type StripeSubscription } from "@/lib/billing";
import { stripe, stripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/confirm — { sessionId }: браузер вернулся со Stripe Checkout. Сессию и подписку проверяем у самого Stripe
// (не верим адресу возврата), так тариф включается сразу, не дожидаясь вебхука.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sessionId)) return badRequest("Invalid session");
    if (!stripeConfigured()) return NextResponse.json({ message: "Payments are not configured yet" }, { status: 503 });
    try {
        const session = await stripe<{ client_reference_id?: string; payment_status?: string; subscription?: string | { id: string } }>("GET", `/checkout/sessions/${sessionId}`);
        if (session.client_reference_id !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (!subId || !["paid", "no_payment_required"].includes(session.payment_status ?? "")) {
            return NextResponse.json({ confirmed: false });
        }
        const sub = await stripe<StripeSubscription>("GET", `/subscriptions/${subId}`);
        await connectDB();
        const updated = await applySubscription(sub);
        return NextResponse.json({ confirmed: !!updated, plan: updated?.plan ?? "free" });
    } catch (e) {
        return failure(e);
    }
}
