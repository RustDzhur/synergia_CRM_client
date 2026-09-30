import { createHash, createHmac, createVerify } from "crypto";
import { ProviderError, fetchProvider } from "@/lib/http";
import { safeEqual } from "@/lib/crypto";
import { secretsOf } from "@/lib/integrations";

// Приём платежей фирмой: monobank, LiqPay, WayForPay и крипта (NOWPayments). Фирма подключает свой
// кабинет эквайринга, а CRM создаёт ссылку на оплату счёта и сама отмечает счёт оплаченным, когда
// приходит вебхук от провайдера. Деньги идут напрямую фирме — платформа к ним отношения не имеет.
//
// У каждого провайдера свой способ подписи запроса и проверки вебхука, поэтому они живут в одном
// файле: так видно и различия, и то общее, что у них есть (ссылка + подписанный колбэк).

export type PayProvider = "monobank" | "liqpay" | "wayforpay" | "cryptopay";

export const PAY_PROVIDERS: Record<PayProvider, { label: string }> = {
    monobank: { label: "monobank" },
    liqpay: { label: "LiqPay" },
    wayforpay: { label: "WayForPay" },
    cryptopay: { label: "Crypto (NOWPayments)" },
};

export interface PayLinkInput {
    amount: number; // в валюте счёта
    currency: string; // ISO 4217
    reference: string; // номер счёта — по нему вебхук находит, что оплачено
    description: string;
    webhookUrl: string;
    returnUrl: string;
    locale: string;
}

export interface PayLink { url: string; id: string }

export interface PayWebhook {
    ok: boolean; // подпись верна
    reference: string; // номер счёта из платежа
    amount: number; // оплаченная сумма
    status: "paid" | "failed" | "other";
}

const keys = (doc: { secrets?: string }) => secretsOf<Record<string, string>>(doc as never);

// ── monobank ────────────────────────────────────────────────────────────────────────────────────────
// Счёт создаётся POST-запросом с токеном мерчанта, в ответ приходит pageUrl. Вебхук подписан ECDSA
// ключом мерчанта: публичную часть отдаёт сам monobank по /api/merchant/pubkey.

async function monobankLink(doc: { secrets?: string }, input: PayLinkInput): Promise<PayLink> {
    const token = String(keys(doc).token ?? "");
    if (!token) throw new ProviderError("У кабінеті monobank не збережено токен мерчанта");
    const res = await fetchProvider("https://api.monobank.ua/api/merchant/invoice/create", {
        method: "POST",
        headers: { "X-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify({
            amount: Math.round(input.amount * 100), // копейки
            ccy: input.currency === "UAH" ? 980 : input.currency === "EUR" ? 978 : 840,
            merchantPaymInfo: { reference: input.reference, destination: input.description.slice(0, 280) },
            redirectUrl: input.returnUrl,
            webHookUrl: input.webhookUrl,
        }),
    });
    const json = (await res.json().catch(() => null)) as { invoiceId?: string; pageUrl?: string; errText?: string; errorDescription?: string } | null;
    if (!res.ok || !json?.pageUrl) throw new ProviderError(json?.errText || json?.errorDescription || `monobank відповів помилкою ${res.status}`);
    return { url: json.pageUrl, id: String(json.invoiceId ?? "") };
}

// Публичный ключ у каждого мерчанта свой, поэтому кэш — по токену (в кэше храним хеш, не сам токен)
const monobankKeys = new Map<string, { value: string; at: number }>();
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
async function monobankPublicKey(token: string, failureMessage = "monobank не віддав публічний ключ для перевірки підпису"): Promise<string> {
    const hit = monobankKeys.get(tokenHash(token));
    if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.value;
    const res = await fetchProvider("https://api.monobank.ua/api/merchant/pubkey", { headers: { "X-Token": token } });
    const json = (await res.json().catch(() => null)) as { key?: string } | null;
    if (!res.ok || !json?.key) throw new ProviderError(failureMessage);
    monobankKeys.set(tokenHash(token), { value: json.key, at: Date.now() });
    return json.key;
}

/** Проверка токена мерчанта до сохранения: публичный ключ отдаётся только рабочему токену */
export async function verifyMonobankToken(token: string): Promise<void> {
    await monobankPublicKey(token, "monobank відхилив токен мерчанта — перевірте токен у кабінеті (Еквайринг → API)");
}

async function monobankWebhook(doc: { secrets?: string }, raw: string, headers: Headers): Promise<PayWebhook> {
    const token = String(keys(doc).token ?? "");
    const signature = headers.get("x-sign") ?? "";
    const amount = Number((JSON.parse(raw || "{}") as { amount?: number }).amount ?? 0) / 100;
    let ok = false;
    try {
        const key = await monobankPublicKey(token);
        ok = createVerify("SHA256").update(raw).verify({ key: Buffer.from(key, "base64"), format: "der", type: "spki" }, Buffer.from(signature, "base64"));
    } catch {
        ok = false;
    }
    const body = JSON.parse(raw || "{}") as { invoiceId?: string; status?: string; reference?: string; failureReason?: string };
    // monobank присылает и промежуточные статусы (processing, hold) — оплатой считаем только success
    const status = body.status === "success" ? "paid" : body.status === "failure" || body.status === "reversed" ? "failed" : "other";
    return { ok, reference: String(body.reference ?? ""), amount, status };
}

// ── LiqPay ──────────────────────────────────────────────────────────────────────────────────────────
// Ссылка собирается из подписанных data+signature: signature = base64(sha1(private_key + data + private_key)).
// Тем же способом подписан и вебхук, поэтому проверка — та же строка.

const liqpaySign = (privateKey: string, data: string) => createHash("sha1").update(privateKey + data + privateKey).digest("base64");

async function liqpayLink(doc: { secrets?: string }, input: PayLinkInput): Promise<PayLink> {
    const s = keys(doc);
    const publicKey = String(s.publicKey ?? "");
    const privateKey = String(s.privateKey ?? "");
    if (!publicKey || !privateKey) throw new ProviderError("У кабінеті LiqPay не збережено публічний і приватний ключі");
    const data = Buffer.from(
        JSON.stringify({
            version: 3,
            public_key: publicKey,
            action: "pay",
            amount: Number(input.amount.toFixed(2)),
            currency: input.currency || "UAH",
            description: input.description.slice(0, 250),
            order_id: input.reference,
            result_url: input.returnUrl,
            server_url: input.webhookUrl,
            language: input.locale === "ua" ? "uk" : input.locale,
        })
    ).toString("base64");
    return { url: `https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(liqpaySign(privateKey, data))}`, id: "" };
}

async function liqpayWebhook(doc: { secrets?: string }, raw: string): Promise<PayWebhook> {
    const privateKey = String(keys(doc).privateKey ?? "");
    const form = new URLSearchParams(raw);
    const data = form.get("data") ?? "";
    const signature = form.get("signature") ?? "";
    const ok = !!privateKey && safeEqual(signature, liqpaySign(privateKey, data));
    let body: { order_id?: string; status?: string; amount?: number } = {};
    try { body = JSON.parse(Buffer.from(data, "base64").toString("utf8")); } catch { body = {}; }
    const status = ["success", "sandbox"].includes(String(body.status)) ? "paid" : ["failure", "error"].includes(String(body.status)) ? "failed" : "other";
    return { ok, reference: String(body.order_id ?? ""), amount: Number(body.amount ?? 0), status };
}

// ── WayForPay ───────────────────────────────────────────────────────────────────────────────────────
// Счёт (CREATE_INVOICE) создаётся подписанным запросом: merchantSignature = HMAC_MD5(secret, поля через «;»).

function wayforpaySign(secret: string, parts: (string | number)[]) {
    return createHmac("md5", secret).update(parts.join(";")).digest("hex");
}

async function wayforpayLink(doc: { secrets?: string }, input: PayLinkInput): Promise<PayLink> {
    const s = keys(doc);
    const merchant = String(s.merchantAccount ?? "");
    const secret = String(s.secretKey ?? "");
    const domain = String(s.merchantDomainName ?? "");
    if (!merchant || !secret) throw new ProviderError("У кабінеті WayForPay не збережено Merchant Account і Secret Key");
    const orderDate = Math.floor(Date.now() / 1000);
    const parts = [merchant, domain || "firmspace", input.reference, orderDate, Number(input.amount.toFixed(2)), input.currency || "UAH", input.description];
    const res = await fetchProvider("https://api.wayforpay.com/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            transactionType: "CREATE_INVOICE",
            apiVersion: 2,
            merchantAccount: merchant,
            merchantDomainName: domain || "firmspace",
            orderReference: input.reference,
            orderDate,
            amount: Number(input.amount.toFixed(2)),
            currency: input.currency || "UAH",
            productName: [input.description.slice(0, 100)],
            productCount: [1],
            productPrice: [Number(input.amount.toFixed(2))],
            serviceUrl: input.webhookUrl,
            merchantSignature: wayforpaySign(secret, parts),
        }),
    });
    const json = (await res.json().catch(() => null)) as { invoiceUrl?: string; pageUrl?: string; url?: string; reason?: string; reasonCode?: number } | null;
    // Название поля со ссылкой WayForPay меняла — принимаем любой из известных, а не гадаем одно
    const url = json?.invoiceUrl ?? json?.pageUrl ?? json?.url ?? "";
    if (!res.ok || !url) throw new ProviderError(json?.reason || `WayForPay відповів помилкою ${res.status}`);
    return { url, id: String(json?.reasonCode ?? "") };
}

async function wayforpayWebhook(doc: { secrets?: string }, raw: string): Promise<PayWebhook> {
    const secret = String(keys(doc).secretKey ?? "");
    const body = JSON.parse(raw || "{}") as { merchantAccount?: string; orderReference?: string; amount?: number; currency?: string; transactionStatus?: string; merchantSignature?: string; reason?: string; reasonCode?: number };
    // Подпись ответа: merchantAccount;orderReference;amount;currency;transactionStatus
    const expected = wayforpaySign(secret, [body.merchantAccount ?? "", body.orderReference ?? "", body.amount ?? "", body.currency ?? "", body.transactionStatus ?? ""]);
    const ok = !!secret && safeEqual(String(body.merchantSignature ?? ""), expected);
    const status = body.transactionStatus === "Approved" ? "paid" : ["Declined", "Refunded", "Expired", "Voided"].includes(String(body.transactionStatus)) ? "failed" : "other";
    return { ok, reference: String(body.orderReference ?? ""), amount: Number(body.amount ?? 0), status };
}

// ── Крипта (NOWPayments) ────────────────────────────────────────────────────────────────────────────
// У фирмы свой кабинет NOWPayments: счёт создаётся её ключом, деньги приходят на её кошелёк.

async function cryptoLink(doc: { secrets?: string }, input: PayLinkInput): Promise<PayLink> {
    const s = keys(doc);
    const apiKey = String(s.apiKey ?? "");
    if (!apiKey) throw new ProviderError("У кабінеті NOWPayments не збережено API-ключ");
    const res = await fetchProvider("https://api.nowpayments.io/v1/invoice", {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
            price_amount: Number(input.amount.toFixed(2)),
            price_currency: (input.currency || "UAH").toLowerCase(),
            order_id: input.reference,
            order_description: input.description.slice(0, 200),
            ipn_callback_url: input.webhookUrl,
            success_url: input.returnUrl,
            cancel_url: input.returnUrl,
            is_fixed_rate: true,
        }),
    });
    const json = (await res.json().catch(() => null)) as { id?: string | number; invoice_url?: string; message?: string } | null;
    if (!res.ok || !json?.invoice_url) throw new ProviderError(json?.message ?? `NOWPayments відповів помилкою ${res.status}`);
    return { url: json.invoice_url, id: String(json.id ?? "") };
}

/** Проверка API-ключа NOWPayments до сохранения: баланс отдаётся только рабочему ключу */
export async function verifyNowpaymentsToken(apiKey: string): Promise<void> {
    const res = await fetchProvider("https://api.nowpayments.io/v1/balance", { headers: { "x-api-key": apiKey } });
    if (res.status === 401 || res.status === 403) throw new ProviderError("NOWPayments відхилив API-ключ — перевірте ключ у кабінеті (Налаштування → API keys)");
    if (!res.ok) throw new ProviderError(`NOWPayments відповів помилкою ${res.status}`);
}

async function cryptoWebhook(doc: { secrets?: string }, raw: string, headers: Headers): Promise<PayWebhook> {
    const secret = String(keys(doc).ipnSecret ?? "");
    const signature = headers.get("x-nowpayments-sig") ?? "";
    const sortDeep = (v: unknown): unknown =>
        Array.isArray(v) ? v.map(sortDeep) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])])) : v;
    let ok = false;
    try {
        ok = !!secret && safeEqual(signature, createHmac("sha512", secret).update(JSON.stringify(sortDeep(JSON.parse(raw || "{}")))).digest("hex"));
    } catch {
        ok = false;
    }
    const body = JSON.parse(raw || "{}") as { order_id?: string; price_amount?: number; payment_status?: string };
    const status = body.payment_status === "finished" || body.payment_status === "confirmed" ? "paid" : ["failed", "refunded", "expired"].includes(String(body.payment_status)) ? "failed" : "other";
    return { ok, reference: String(body.order_id ?? ""), amount: Number(body.price_amount ?? 0), status };
}

// ── общие вызовы ────────────────────────────────────────────────────────────────────────────────────

export async function createPayLink(provider: PayProvider, doc: { secrets?: string }, input: PayLinkInput): Promise<PayLink> {
    if (provider === "monobank") return monobankLink(doc, input);
    if (provider === "liqpay") return liqpayLink(doc, input);
    if (provider === "wayforpay") return wayforpayLink(doc, input);
    if (provider === "cryptopay") return cryptoLink(doc, input);
    throw new ProviderError("Невідомий спосіб оплати");
}

export async function verifyPayWebhook(provider: PayProvider, doc: { secrets?: string }, raw: string, headers: Headers): Promise<PayWebhook> {
    if (provider === "monobank") return monobankWebhook(doc, raw, headers);
    if (provider === "liqpay") return liqpayWebhook(doc, raw);
    if (provider === "wayforpay") return wayforpayWebhook(doc, raw);
    if (provider === "cryptopay") return cryptoWebhook(doc, raw, headers);
    throw new ProviderError("Невідомий спосіб оплати");
}

export const isPayProvider = (v: string): v is PayProvider => (Object.keys(PAY_PROVIDERS) as string[]).includes(v);
