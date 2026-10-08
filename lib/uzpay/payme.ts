import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safeEqual } from "@/lib/crypto";
import { secretsOf } from "@/lib/integrations";
import { registerPayment, revertPayment } from "@/lib/sync/payments";
import { findPayableInvoice, isPayable, payKey, round2 } from "./common";

// Payme Business — Merchant API (https://developer.help.paycom.uz/protokol-merchant-api/).
// Payme сам вызывает адрес фирмы (JSON-RPC 2.0, POST, всегда HTTP 200). Авторизация: Basic base64("Paycom:<ключ кассы>");
// в песочнице test.paycom.uz вместо ключа — тестовый ключ. Суммы в тийинах (1 сум = 100 тийин). Поле счёта в кассе — order_id (номер счёта).
// Состояния: 1 создана, 2 выполнена, -1 отменена до выполнения, -2 отменена после выполнения. Таймаут созданной транзакции — 12 часов.

export const PAYME_TIMEOUT_MS = 43_200_000;
const ACCOUNT_FIELD = "order_id";

type Msg = { ru: string; uz: string; en: string };
const MSG = {
    auth: { ru: "Недостаточно привилегий для выполнения метода", uz: "Metodni bajarish uchun huquqlar yetarli emas", en: "Insufficient privileges to perform the method" },
    amount: { ru: "Неверная сумма", uz: "Noto‘g‘ri summa", en: "Invalid amount" },
    account: { ru: "Счёт не найден или недоступен для оплаты", uz: "Hisob-faktura topilmadi yoki to‘lash mumkin emas", en: "Invoice not found or not payable" },
    cannot: { ru: "Невозможно выполнить операцию", uz: "Amalni bajarib bo‘lmaydi", en: "Unable to perform the operation" },
    notFound: { ru: "Транзакция не найдена", uz: "Tranzaksiya topilmadi", en: "Transaction not found" },
    fulfilled: { ru: "Заказ выполнен, транзакцию отменить нельзя", uz: "Buyurtma bajarilgan, tranzaksiyani bekor qilib bo‘lmaydi", en: "Order is fulfilled, the transaction cannot be cancelled" },
    method: { ru: "Метод не найден", uz: "Metod topilmadi", en: "Method not found" },
    parse: { ru: "Ошибка разбора JSON", uz: "JSON xatosi", en: "JSON parse error" },
    system: { ru: "Системная ошибка", uz: "Tizim xatosi", en: "System error" },
} satisfies Record<string, Msg>;

class RpcError extends Error {
    constructor(public code: number, public msg: Msg, public data?: string) { super(msg.en); }
}
const E = {
    auth: () => new RpcError(-32504, MSG.auth),
    amount: () => new RpcError(-31001, MSG.amount),
    account: () => new RpcError(-31050, MSG.account, ACCOUNT_FIELD),
    cannot: () => new RpcError(-31008, MSG.cannot),
    notFound: () => new RpcError(-31003, MSG.notFound),
    fulfilled: () => new RpcError(-31007, MSG.fulfilled),
};

interface Doc { owner: string; secrets?: string; config?: unknown }
const keysOf = (doc: Doc) => secretsOf<{ key?: string; testKey?: string }>(doc as never);

/** Authorization: Basic base64("Paycom:<ключ>") — ключ кассы или (в песочнице) тестовый ключ. */
export function paymeAuthorized(doc: Doc, header: string | null): boolean {
    const m = /^Basic\s+(.+)$/i.exec(header ?? "");
    if (!m) return false;
    const [login, ...rest] = Buffer.from(m[1], "base64").toString("utf8").split(":");
    const pass = rest.join(":");
    if (login !== "Paycom" || !pass) return false;
    const k = keysOf(doc);
    return (!!k.key && safeEqual(pass, k.key)) || (!!k.testKey && safeEqual(pass, k.testKey));
}

const toSom = (tiyin: number) => round2(tiyin / 100);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const accountOrder = (params: Record<string, unknown>) => String(((params.account ?? {}) as Record<string, unknown>)[ACCOUNT_FIELD] ?? "");

async function checkPerform(org: string, params: Record<string, unknown>) {
    const tiyin = num(params.amount);
    if (!Number.isInteger(tiyin) || tiyin <= 0) throw E.amount();
    const inv = await findPayableInvoice(org, accountOrder(params));
    if (!inv || !isPayable(inv)) throw E.account();
    if (tiyin !== Math.round(inv.outstanding * 100)) throw E.amount();
    return inv;
}

const shape = (t: { seq: number; state: number; reason: number | null; createdAt: Date; performedAt: Date | null; cancelledAt: Date | null }) => ({
    create_time: t.createdAt.getTime(), perform_time: t.performedAt?.getTime() ?? 0, cancel_time: t.cancelledAt?.getTime() ?? 0,
    transaction: String(t.seq), state: t.state, reason: t.reason,
});

async function findTx(id: unknown) {
    const tx = typeof id === "string" ? await prisma.uzPayTx.findUnique({ where: { provider_externalId: { provider: "payme", externalId: id } } }) : null;
    if (!tx) throw E.notFound();
    return tx;
}

/** Просроченная (12 часов) транзакция в состоянии 1 отменяется сама: причина 4. */
async function expireIfNeeded<T extends { id: string; state: number; createdAt: Date }>(tx: T): Promise<T & { state: number }> {
    if (tx.state === 1 && Date.now() - tx.createdAt.getTime() > PAYME_TIMEOUT_MS) {
        await prisma.uzPayTx.update({ where: { id: tx.id }, data: { state: -1, reason: 4, cancelledAt: new Date() } });
        return { ...tx, state: -1 };
    }
    return tx;
}

async function createTransaction(org: string, params: Record<string, unknown>) {
    const id = String(params.id ?? "");
    if (!id) throw E.notFound();
    const existing = await prisma.uzPayTx.findUnique({ where: { provider_externalId: { provider: "payme", externalId: id } } });
    if (existing) {
        const tx = await expireIfNeeded(existing);
        if (tx.state !== 1) throw E.cannot();
        return { create_time: tx.createdAt.getTime(), transaction: String(tx.seq), state: 1 };
    }
    const inv = await checkPerform(org, params);
    // по одному счёту одновременно живёт одна транзакция: вторая, пока первая не выполнена и не отменена, — ошибка -31008
    const open = await prisma.uzPayTx.findMany({ where: { org, provider: "payme", invoiceId: inv.id, state: 1 } });
    for (const o of open) if ((await expireIfNeeded(o)).state === 1) throw E.cannot();
    try {
        const tx = await prisma.uzPayTx.create({ data: { org, provider: "payme", externalId: id, invoiceId: inv.id, reference: inv.number, amount: toSom(num(params.amount)), state: 1, extTime: BigInt(Math.round(num(params.time)) || Date.now()) } });
        return { create_time: tx.createdAt.getTime(), transaction: String(tx.seq), state: 1 };
    } catch (e) {
        // две одновременные доставки одного CreateTransaction: вторая видит уже созданную
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            const tx = await findTx(id);
            if (tx.state !== 1) throw E.cannot();
            return { create_time: tx.createdAt.getTime(), transaction: String(tx.seq), state: 1 };
        }
        throw e;
    }
}

async function performTransaction(org: string, params: Record<string, unknown>) {
    const tx0 = await findTx(params.id);
    if (tx0.org !== org) throw E.notFound();
    const tx = await expireIfNeeded(tx0);
    if (tx.state === 2) return { transaction: String(tx.seq), perform_time: tx.performedAt?.getTime() ?? 0, state: 2 };
    if (tx.state !== 1) throw E.cannot();
    const res = await registerPayment(org, tx.invoiceId, { amount: tx.amount, source: "webhook", externalId: payKey("payme", tx.externalId), via: "payme", actor: { name: "Payme" } });
    if (!res.ok) throw E.cannot(); // счёт закрыт или удалён, пока шла оплата
    const done = await prisma.uzPayTx.update({ where: { id: tx.id }, data: { state: 2, performedAt: new Date() } });
    return { transaction: String(done.seq), perform_time: done.performedAt?.getTime() ?? 0, state: 2 };
}

async function cancelTransaction(org: string, params: Record<string, unknown>) {
    const tx0 = await findTx(params.id);
    if (tx0.org !== org) throw E.notFound();
    const tx = await expireIfNeeded(tx0);
    const reason = Number.isInteger(params.reason) ? Number(params.reason) : null;
    const out = (s: { seq: number; state: number; cancelledAt: Date | null }) => ({ transaction: String(s.seq), cancel_time: s.cancelledAt?.getTime() ?? 0, state: s.state });
    if (tx.state === -1 || tx.state === -2) return out(await prisma.uzPayTx.findUniqueOrThrow({ where: { id: tx.id } }));
    if (tx.state === 1) return out(await prisma.uzPayTx.update({ where: { id: tx.id }, data: { state: -1, reason, cancelledAt: new Date() } }));
    // возврат после выполнения: платёж снимается со счёта; закрытый период или удалённый счёт — «заказ выполнен» (-31007)
    const rev = await revertPayment(org, tx.invoiceId, { source: "webhook", externalId: payKey("payme", tx.externalId), amount: tx.amount, actor: { name: "Payme" } });
    if (!rev.ok) throw E.fulfilled();
    return out(await prisma.uzPayTx.update({ where: { id: tx.id }, data: { state: -2, reason, cancelledAt: new Date() } }));
}

async function checkTransaction(org: string, params: Record<string, unknown>) {
    const tx = await findTx(params.id);
    if (tx.org !== org) throw E.notFound();
    return shape(await expireIfNeeded(tx));
}

async function getStatement(org: string, params: Record<string, unknown>) {
    const from = num(params.from), to = num(params.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) throw E.amount();
    // GetStatement отдаёт транзакции по времени, которое Payme прислал в CreateTransaction (поле time)
    const rows = await prisma.uzPayTx.findMany({ where: { org, provider: "payme", extTime: { gte: BigInt(Math.round(from)), lte: BigInt(Math.round(to)) } }, orderBy: { extTime: "asc" }, take: 1000 });
    return {
        transactions: rows.map((t) => ({
            id: t.externalId, time: Number(t.extTime ?? 0), amount: Math.round(t.amount * 100), account: { [ACCOUNT_FIELD]: t.reference },
            ...shape(t), receivers: null,
        })),
    };
}

/** Обработка одного JSON-RPC-запроса Payme. Всегда возвращает тело ответа (HTTP-статус вызывающий ставит 200). */
export async function handlePayme(doc: Doc, authHeader: string | null, raw: string): Promise<Record<string, unknown>> {
    let body: { method?: string; params?: Record<string, unknown>; id?: unknown };
    try { body = JSON.parse(raw); } catch { return { error: { code: -32700, message: MSG.parse }, id: null }; }
    const id = body?.id ?? null;
    const fail = (e: RpcError) => ({ error: { code: e.code, message: e.msg, ...(e.data ? { data: e.data } : {}) }, id });
    if (!paymeAuthorized(doc, authHeader)) return fail(E.auth());
    const org = String(doc.owner);
    const params = (body.params ?? {}) as Record<string, unknown>;
    try {
        switch (body.method) {
            case "CheckPerformTransaction": await checkPerform(org, params); return { result: { allow: true }, id };
            case "CreateTransaction": return { result: await createTransaction(org, params), id };
            case "PerformTransaction": return { result: await performTransaction(org, params), id };
            case "CancelTransaction": return { result: await cancelTransaction(org, params), id };
            case "CheckTransaction": return { result: await checkTransaction(org, params), id };
            case "GetStatement": return { result: await getStatement(org, params), id };
            // фискальные данные Payme присылает после оплаты; принимаем без изменений
            case "SetFiscalData": return { result: { success: true }, id };
            default: return fail(new RpcError(-32601, MSG.method, String(body.method ?? "")));
        }
    } catch (e) {
        if (e instanceof RpcError) return fail(e);
        console.error("[payme]", e instanceof Error ? e.message : e);
        return fail(new RpcError(-32400, MSG.system));
    }
}

/** Ссылка на кассу Payme: base64("m=<id кассы>;ac.order_id=<номер счёта>;a=<тийины>;l=<язык>;c=<возврат>;cr=860"). */
export function paymeCheckoutUrl(input: { merchantId: string; test: boolean; reference: string; amountSom: number; locale: string; returnUrl: string }): string {
    const lang = input.locale === "uz" ? "uz" : input.locale === "en" ? "en" : "ru";
    const parts = [`m=${input.merchantId}`, `ac.${ACCOUNT_FIELD}=${input.reference}`, `a=${Math.round(input.amountSom * 100)}`, `l=${lang}`, `c=${input.returnUrl}`, "cr=860"];
    return `${input.test ? "https://test.paycom.uz" : "https://checkout.paycom.uz"}/${Buffer.from(parts.join(";")).toString("base64")}`;
}
