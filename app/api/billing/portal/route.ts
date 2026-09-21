import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { failure, unauthorized } from "@/lib/api";
import { stripe, stripeConfigured } from "@/lib/stripe";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const LOCALES = ["en", "de", "ua"];

// POST /api/billing/portal — { locale } → { url } на кабинет оплаты Stripe: смена тарифа, способ оплаты, счета, отмена подписки
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!stripeConfigured()) return NextResponse.json({ message: "Payments are not configured yet" }, { status: 503 });
    const body = await req.json().catch(() => ({}));
    const locale = LOCALES.includes(body?.locale) ? body.locale : "en";
    try {
        await connectDB();
        const doc = await User.findById(user.id).select("billing");
        if (!doc?.billing?.customerId) return NextResponse.json({ message: "No subscription yet" }, { status: 404 });
        const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
            customer: doc.billing.customerId,
            return_url: `${appOrigin(req)}/${locale}/crm/upgrade`,
        });
        return NextResponse.json({ url: session.url });
    } catch (e) {
        return failure(e);
    }
}
