import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { verifyIpn } from "@/lib/nowpayments";
import CryptoPayment from "@/models/CryptoPayment";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

const PAID = ["finished", "confirmed"]; // средства подтверждены в блокчейне
const ENDED = ["failed", "expired", "refunded"];

// POST /api/webhooks/nowpayments — уведомления об оплате счёта (IPN). В кабинете NOWPayments (Store settings → Payments) задайте IPN Secret
// (он же NOWPAYMENTS_IPN_SECRET); адрес уведомлений CRM передаёт в каждом счёте сама. Подпись проверяется, план и сумма берутся из нашей записи.
export async function POST(req: Request) {
    const secret = process.env.NOWPAYMENTS_IPN_SECRET ?? "";
    const raw = await req.text();
    if (!verifyIpn(raw, req.headers.get("x-nowpayments-sig"), secret)) return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    let p: { order_id?: string; payment_status?: string; price_amount?: number | string; price_currency?: string };
    try { p = JSON.parse(raw); } catch { return NextResponse.json({ message: "Invalid JSON" }, { status: 400 }); }
    try {
        await connectDB();
        const payment = await CryptoPayment.findOne({ orderId: String(p.order_id ?? "") });
        if (!payment) return NextResponse.json({ received: true }); // чужой или старый счёт
        const status = String(p.payment_status ?? "");
        if (PAID.includes(status)) {
            const amountOk = Number(p.price_amount) === payment.amountEur && String(p.price_currency ?? "").toLowerCase() === "eur";
            if (!payment.applied && amountOk) {
                const org = await Organization.findById(payment.org);
                if (org) {
                    // оплата продлевает тот же тариф с конца текущего срока, иначе — отсчёт от сегодня
                    const now = new Date();
                    const from = org.planOverride === payment.plan && org.planOverrideUntil && org.planOverrideUntil > now ? new Date(org.planOverrideUntil) : now;
                    if (payment.interval === "year") from.setFullYear(from.getFullYear() + 1); else from.setMonth(from.getMonth() + 1);
                    org.planOverride = payment.plan;
                    org.planOverrideUntil = from;
                    await org.save();
                    payment.applied = true;
                }
            }
            payment.status = "finished";
        } else if (ENDED.includes(status) || ["waiting", "confirming", "sending", "partially_paid"].includes(status)) {
            if (!payment.applied) payment.status = status;
        }
        await payment.save();
        return NextResponse.json({ received: true });
    } catch {
        return NextResponse.json({ message: "Processing failed" }, { status: 500 }); // NOWPayments повторит доставку
    }
}
