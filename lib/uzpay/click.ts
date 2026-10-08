import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/crypto";
import { secretsOf } from "@/lib/integrations";
import { registerPayment } from "@/lib/sync/payments";
import { findPayableInvoice, isPayable, payKey, round2 } from "./common";

// Click — SHOP API (https://docs.click.uz/shop-api/requests). Click сам вызывает адрес фирмы двумя запросами (POST, form-urlencoded):
// Prepare (action=0) — проверить счёт и зарезервировать, Complete (action=1) — деньги списаны (error=0) или платёж отменён (error<0).
// Подпись sign_string = MD5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id [+ merchant_prepare_id для Complete] + amount + action + sign_time).
// Сумма — в сумах, десятичная. merchant_trans_id — номер счёта. Ответ — JSON с кодами 0, -1 … -9.

interface Doc { owner: string; secrets?: string; config?: unknown }
interface ClickKeys { secretKey?: string }
const cfgOf = (doc: Doc) => (doc.config ?? {}) as Record<string, string>;

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const idNum = (v: string) => (/^\d+$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : v);

export function clickSign(secret: string, p: Record<string, string>, complete: boolean): string {
    return md5(`${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${complete ? p.merchant_prepare_id ?? "" : ""}${p.amount}${p.action}${p.sign_time}`);
}

const ERR = {
    sign: [-1, "SIGN CHECK FAILED!"], amount: [-2, "Incorrect parameter amount"], action: [-3, "Action not found"], paid: [-4, "Already paid"],
    user: [-5, "User does not exist"], tx: [-6, "Transaction does not exist"], update: [-7, "Failed to update user"], request: [-8, "Error in request from click"], cancelled: [-9, "Transaction cancelled"],
} as const;

/** Параметры приходят формой (application/x-www-form-urlencoded); JSON принимаем на случай проверки вручную. */
export function parseClickBody(raw: string): Record<string, string> {
    const t = raw.trim();
    if (t.startsWith("{")) {
        try { return Object.fromEntries(Object.entries(JSON.parse(t) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])); } catch { return {}; }
    }
    return Object.fromEntries(new URLSearchParams(raw).entries());
}

export async function handleClick(doc: Doc, raw: string): Promise<Record<string, unknown>> {
    const p = parseClickBody(raw);
    const org = String(doc.owner);
    const reply = (e: readonly [number, string], extra: Record<string, unknown> = {}) => ({
        click_trans_id: idNum(p.click_trans_id ?? ""), merchant_trans_id: p.merchant_trans_id ?? "", ...extra, error: e[0], error_note: e[1],
    });
    const action = p.action === "0" ? 0 : p.action === "1" ? 1 : -1;
    if (action < 0) return reply(ERR.action);
    const required = ["click_trans_id", "service_id", "merchant_trans_id", "amount", "sign_time", "sign_string", ...(action === 1 ? ["merchant_prepare_id"] : [])];
    if (required.some((k) => !p[k]?.length)) return reply(ERR.request, action === 0 ? { merchant_prepare_id: 0 } : { merchant_confirm_id: null });

    const secret = secretsOf<ClickKeys>(doc as never).secretKey ?? "";
    if (!secret || !safeEqual(p.sign_string, clickSign(secret, p, action === 1))) return reply(ERR.sign, action === 0 ? { merchant_prepare_id: 0 } : { merchant_confirm_id: null });
    if (String(cfgOf(doc).serviceId ?? "") !== p.service_id) return reply(ERR.request, action === 0 ? { merchant_prepare_id: 0 } : { merchant_confirm_id: null });

    const clickError = Number(p.error ?? 0) || 0;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount)) return reply(ERR.amount, action === 0 ? { merchant_prepare_id: 0 } : { merchant_confirm_id: null });

    if (action === 0) {
        const fail = (e: readonly [number, string]) => reply(e, { merchant_prepare_id: 0 });
        const prior = await prisma.uzPayTx.findUnique({ where: { provider_externalId: { provider: "click", externalId: p.click_trans_id } } });
        if (prior) {
            // повторный Prepare того же платежа: тот же ответ, ничего не создаём
            if (prior.state === 2) return fail(ERR.paid);
            if (prior.state < 0) return fail(ERR.cancelled);
            return reply([0, "Success"], { merchant_prepare_id: prior.seq });
        }
        if (clickError < 0) return fail(ERR.cancelled);
        const inv = await findPayableInvoice(org, p.merchant_trans_id);
        if (!inv) return fail(ERR.user);
        if (inv.status === "paid" || inv.outstanding <= 0) return fail(ERR.paid);
        if (inv.status === "cancelled") return fail(ERR.cancelled);
        if (!isPayable(inv)) return fail(ERR.user);
        if (Math.abs(amount - inv.outstanding) > 0.01) return fail(ERR.amount);
        const tx = await prisma.uzPayTx.create({ data: { org, provider: "click", externalId: p.click_trans_id, invoiceId: inv.id, reference: inv.number, amount: round2(amount), state: 0 } });
        return reply([0, "Success"], { merchant_prepare_id: tx.seq });
    }

    const fail = (e: readonly [number, string]) => reply(e, { merchant_confirm_id: null });
    const tx = await prisma.uzPayTx.findFirst({ where: { provider: "click", seq: Number(p.merchant_prepare_id) || -1, org } });
    if (!tx || tx.externalId !== p.click_trans_id || tx.reference !== p.merchant_trans_id) return fail(ERR.tx);
    // отмена со стороны Click: снять резерв и ответить -9 (как требует документация)
    if (clickError < 0) {
        if (tx.state === 0) await prisma.uzPayTx.update({ where: { id: tx.id }, data: { state: -1, reason: clickError, cancelledAt: new Date() } });
        return fail(ERR.cancelled);
    }
    if (tx.state === 2) return fail(ERR.paid);
    if (tx.state < 0) return fail(ERR.cancelled);
    if (Math.abs(amount - tx.amount) > 0.01) return fail(ERR.amount);
    const res = await registerPayment(org, tx.invoiceId, { amount: tx.amount, source: "webhook", externalId: payKey("click", tx.externalId), via: "click", actor: { name: "Click" } });
    // деньги у Click уже списаны: счёт мог быть закрыт или оплачен другим путём. Подтверждаем получение (ошибка здесь зависает платёж),
    // расхождение остаётся в журнале платежей для ручного разбора.
    if (!res.ok) console.error("[click] payment accepted but invoice cannot take it", tx.invoiceId);
    await prisma.uzPayTx.update({ where: { id: tx.id }, data: { state: 2, performedAt: new Date() } });
    return reply([0, "Success"], { merchant_confirm_id: tx.seq });
}

/** Ссылка на страницу оплаты Click. amount — формат N.NN. */
export function clickPayUrl(input: { merchantId: string; serviceId: string; merchantUserId?: string; reference: string; amountSom: number; returnUrl: string }): string {
    const q = new URLSearchParams({ service_id: input.serviceId, merchant_id: input.merchantId, amount: input.amountSom.toFixed(2), transaction_param: input.reference, return_url: input.returnUrl });
    if (input.merchantUserId) q.set("merchant_user_id", input.merchantUserId);
    return `https://my.click.uz/services/pay?${q.toString()}`;
}
