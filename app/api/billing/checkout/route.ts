import { NextResponse } from "next/server";
import { PLANS } from "@/app/config/plans";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { amountCents, isPaidPlan, type Interval } from "@/lib/billing";
import { stripe, stripeConfigured } from "@/lib/stripe";
import Organization from "@/models/Organization";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const LOCALES = ["en", "de", "ua"];
// Stripe не поддерживает украинский язык страницы оплаты — для него он подбирает язык по браузеру ("auto")
const STRIPE_LOCALE: Record<string, string> = { en: "en", de: "de", ua: "auto" };
const ACTIVE = ["active", "trialing", "past_due"];

// POST /api/billing/checkout — { plan: "standard" | "professional", interval: "month" | "year", locale }
// Создаёт сессию Stripe Checkout и возвращает { url } — на него браузер переходит для оплаты.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    if (!body || !isPaidPlan(body.plan) || (body.interval !== "month" && body.interval !== "year")) return badRequest("Invalid plan");
    if (!stripeConfigured()) return NextResponse.json({ message: "Payments are not configured yet" }, { status: 503 });
    const plan = body.plan;
    const interval = body.interval as Interval;
    const locale = LOCALES.includes(body.locale) ? (body.locale as string) : "en";

    try {
        await connectDB();
        const doc = await Organization.findById(user.id);
        if (!doc) return unauthorized(req);
        const owner = await User.findById(doc.ownerUser).select("email firstname lastname");
        // уже есть действующая подписка — тариф меняют в кабинете оплаты (Manage billing), иначе получилась бы вторая подписка
        if (doc.billing?.subscriptionId && ACTIVE.includes(doc.billing.status ?? "")) {
            return NextResponse.json({ message: "You already have a subscription. Use Manage billing to change it." }, { status: 409 });
        }
        let customer = doc.billing?.customerId ?? "";
        if (!customer) {
            const c = await stripe<{ id: string }>("POST", "/customers", {
                email: owner?.email,
                name: doc.name,
                metadata: { orgId: user.id },
            });
            customer = c.id;
            doc.set("billing.customerId", customer);
            await doc.save();
        }
        const origin = appOrigin(req);
        const label = PLANS.find((p) => p.id === plan) ? plan[0].toUpperCase() + plan.slice(1) : plan;
        const meta = { orgId: user.id, plan, interval };
        const session = await stripe<{ url: string }>("POST", "/checkout/sessions", {
            mode: "subscription",
            customer,
            client_reference_id: user.id,
            locale: STRIPE_LOCALE[locale],
            allow_promotion_codes: true,
            success_url: `${origin}/${locale}/crm/upgrade?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/${locale}/crm/upgrade?checkout=cancel`,
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: "eur",
                        unit_amount: amountCents(plan, interval),
                        recurring: { interval },
                        // облачное ПО для бизнеса: этот налоговый код нужен Stripe Managed Payments (Stripe как продавец считает НДС)
                        product_data: { name: `Firmspace CRM ${label}`, tax_code: "txcd_10103001" },
                    },
                },
            ],
            metadata: meta,
            subscription_data: { metadata: meta },
            // аварийный выключатель: STRIPE_MANAGED_PAYMENTS=0 отключает Managed Payments для этих сессий (продавец — вы, налоги — ваши)
            ...(process.env.STRIPE_MANAGED_PAYMENTS === "0" ? { managed_payments: { enabled: false } } : {}),
        });
        return NextResponse.json({ url: session.url });
    } catch (e) {
        return failure(e);
    }
}
