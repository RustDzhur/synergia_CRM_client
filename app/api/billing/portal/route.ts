import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { appOrigin } from "@/lib/appUrl";
import { failure, unauthorized } from "@/lib/api";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const LOCALES = ["en", "de", "ua"];

// POST /api/billing/portal — { locale } → { url } на кабинет оплаты Stripe: смена тарифа, способ оплаты, счета, отмена подписки
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!stripeConfigured()) return NextResponse.json({ message: "Payments are not configured yet" }, { status: 503 });
    const body = await req.json().catch(() => ({}));
    const locale = LOCALES.includes(body?.locale) ? body.locale : "en";
    try {
        const doc = await prisma.organization.findUnique({ where: { id: user.id }, select: { billing: true } });
        const billing = (doc?.billing ?? {}) as any;
        if (!billing.customerId) return NextResponse.json({ message: "No subscription yet" }, { status: 404 });
        const session = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
            customer: billing.customerId,
            return_url: `${appOrigin(req)}/${locale}/crm/upgrade`,
        });
        return NextResponse.json({ url: session.url });
    } catch (e) {
        return failure(e);
    }
}
