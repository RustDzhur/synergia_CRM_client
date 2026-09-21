import { createHmac } from "crypto";
import { ProviderError, fetchProvider } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";

// Оплата криптовалютой через NOWPayments: сервис создаёт счёт и страницу оплаты, клиент платит любой из поддерживаемых монет,
// а деньги приходят на кошелёк, указанный в кабинете NOWPayments (режим выплат на свой кошелёк). Абонплаты нет, комиссия — с платежа.
// NOWPAYMENTS_API_URL нужен только для проверки на имитации (песочница: https://api-sandbox.nowpayments.io/v1).
const base = () => (process.env.NOWPAYMENTS_API_URL || "https://api.nowpayments.io/v1").replace(/\/+$/, "");
export const cryptoConfigured = () => !!(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);

export interface InvoiceInput { priceAmount: number; orderId: string; description: string; ipnUrl: string; successUrl: string; cancelUrl: string }

export async function createInvoice(i: InvoiceInput) {
    const res = await fetchProvider(`${base()}/invoice`, {
        method: "POST",
        headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({
            price_amount: i.priceAmount,
            price_currency: "eur",
            order_id: i.orderId,
            order_description: i.description,
            ipn_callback_url: i.ipnUrl,
            success_url: i.successUrl,
            cancel_url: i.cancelUrl,
            is_fixed_rate: true, // курс фиксируется на время оплаты счёта
        }),
    });
    const json = (await res.json().catch(() => null)) as { id?: string | number; invoice_url?: string; message?: string } | null;
    if (!res.ok || !json?.invoice_url) throw new ProviderError(json?.message ?? `NOWPayments error ${res.status}`);
    return { id: String(json.id ?? ""), url: json.invoice_url };
}

// Подпись вебхука (x-nowpayments-sig): HMAC-SHA512 от JSON тела с ключами, отсортированными по алфавиту на всех уровнях, секретом IPN
const sortDeep = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(sortDeep) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])])) : v;

export function verifyIpn(rawBody: string, header: string | null, secret: string) {
    if (!header || !secret) return false;
    try {
        const expected = createHmac("sha512", secret).update(JSON.stringify(sortDeep(JSON.parse(rawBody)))).digest("hex");
        return safeEqual(header.toLowerCase(), expected);
    } catch {
        return false;
    }
}
