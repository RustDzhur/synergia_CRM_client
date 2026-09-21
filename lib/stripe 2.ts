import { createHmac } from "crypto";
import { ProviderError, fetchProvider } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";

// Stripe без SDK: приём платежей и подписки через Stripe Checkout (карты, SEPA и другие способы, включённые в кабинете Stripe).
// STRIPE_API_URL нужен только для проверки на имитации; в проде не задаётся.
const base = () => (process.env.STRIPE_API_URL || "https://api.stripe.com/v1").replace(/\/+$/, "");
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

type Param = string | number | boolean | null | undefined | Param[] | { [k: string]: Param };

// Stripe принимает форму, где вложенность записана скобками: line_items[0][price_data][currency]=eur
export function encodeForm(params: Record<string, Param>): string {
    const out: [string, string][] = [];
    const walk = (value: Param, key: string) => {
        if (value === undefined || value === null) return;
        if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${key}[${i}]`));
        else if (typeof value === "object") Object.entries(value).forEach(([k, v]) => walk(v, `${key}[${k}]`));
        else out.push([key, String(value)]);
    };
    Object.entries(params).forEach(([k, v]) => walk(v, k));
    return out.map(([k, v]) => `${encodeURIComponent(k).replace(/%5B/g, "[").replace(/%5D/g, "]")}=${encodeURIComponent(v)}`).join("&");
}

export async function stripe<T = Record<string, any>>(method: "GET" | "POST", path: string, params: Record<string, Param> = {}): Promise<T> {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new ProviderError("Payments are not configured");
    const body = encodeForm(params);
    const res = await fetchProvider(`${base()}${path}${method === "GET" && body ? `?${body}` : ""}`, {
        method,
        headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
        body: method === "POST" ? body : undefined,
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !json) throw new ProviderError(json?.error?.message ?? `Stripe error ${res.status}`);
    return json;
}

// Заголовок Stripe-Signature: «t=время,v1=подпись[,v1=…]», подпись — HMAC-SHA256 от «время.тело» секретом вебхука (whsec_…)
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()) {
    if (!header || !secret) return false;
    const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
    const t = parts.find(([k]) => k === "t")?.[1];
    const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
    if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > toleranceSec) return false;
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    return sigs.some((s) => safeEqual(s, expected));
}
