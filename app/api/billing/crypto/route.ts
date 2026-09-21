import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { amountCents, isPaidPlan } from "@/lib/billing";
import { randomToken } from "@/lib/crypto";
import { createInvoice, cryptoConfigured } from "@/lib/nowpayments";
import CryptoPayment from "@/models/CryptoPayment";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

const LOCALES = ["en", "de", "ua"];
const ACTIVE = ["active", "trialing", "past_due"];

// POST /api/billing/crypto — { plan, interval, locale }: счёт на оплату криптовалютой → { url } страницы оплаты NOWPayments.
// Это разовая оплата на месяц или год (без автопродления): по факту оплаты тариф включается на этот срок.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || !isPaidPlan(b.plan) || (b.interval !== "month" && b.interval !== "year")) return badRequest("Invalid plan");
    if (!cryptoConfigured()) return NextResponse.json({ message: "Crypto payments are not configured yet" }, { status: 503 });
    const locale = LOCALES.includes(b.locale) ? (b.locale as string) : "en";
    try {
        await connectDB();
        const org = await Organization.findById(user.id).select("billing name");
        if (org?.billing?.subscriptionId && ACTIVE.includes(org.billing.status ?? "")) {
            return NextResponse.json({ message: "You already have a card subscription. Use Manage billing to change it." }, { status: 409 });
        }
        const amountEur = amountCents(b.plan, b.interval) / 100;
        const orderId = `fs-${user.id}-${randomToken(6)}`;
        const payment = await CryptoPayment.create({ org: user.id, plan: b.plan, interval: b.interval, amountEur, orderId });
        const origin = appOrigin(req);
        const invoice = await createInvoice({
            priceAmount: amountEur,
            orderId,
            description: `Firmspace CRM ${b.plan} (${b.interval === "year" ? "12 months" : "1 month"})`,
            ipnUrl: `${origin}/api/webhooks/nowpayments`,
            successUrl: `${origin}/${locale}/crm/upgrade?crypto=success`,
            cancelUrl: `${origin}/${locale}/crm/upgrade?crypto=cancel`,
        });
        payment.invoiceId = invoice.id;
        payment.status = "waiting";
        await payment.save();
        return NextResponse.json({ url: invoice.url });
    } catch (e) {
        return failure(e);
    }
}
