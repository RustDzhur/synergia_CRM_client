import { PLANS, YEAR_MONTHS, type PlanId } from "@/config/plans";
import { randomToken } from "@/lib/crypto";
import { epcPayload, normalizeIban, qrMatrix } from "@/lib/finance/qr";
import { financeSettings } from "@/lib/finance/settings";
import { marketOf, type Market } from "@/lib/finance/market";
import { isPaidPlan } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

// Оплата тарифов платформы переводом — без Stripe и других посредников с комиссией.
// Клиент выбирает «банковский перевод» или «USDT», получает оформленный счёт с реквизитами платформы и QR-кодом
// (EPC/Girocode для евро-перевода по Германии, QR НБУ для гривневого перевода по Украине, адрес кошелька для USDT).
// Оплату подтверждает администратор платформы вручную одной кнопкой — тариф включается на месяц/год (как и раньше,
// через planOverride/planOverrideUntil). Деньги идут напрямую на реквизиты администратора.
//
// Хранение без миграций схемы: реквизиты — PlatformSettings("payRequisites"), заказы — SectionRecord("billing:order").

export type Method = "bank" | "usdt";
export type OrderStatus = "new" | "claimed" | "paid" | "cancelled";
export type Interval = "month" | "year";

export interface PayRequisites {
    de: { name: string; address: string; iban: string; bic: string; bank: string; vatId: string; vatNote: string };
    ua: { name: string; address: string; iban: string; bank: string; mfo: string; edrpou: string; vatNote: string };
    usdt: { address: string; network: string; perEur: number };
    uahPrices: Record<"standard" | "professional", { month: number; year: number }>;
}

export const EMPTY_REQUISITES: PayRequisites = {
    de: { name: "", address: "", iban: "", bic: "", bank: "", vatId: "", vatNote: "" },
    ua: { name: "", address: "", iban: "", bank: "", mfo: "", edrpou: "", vatNote: "" },
    usdt: { address: "", network: "TRC-20", perEur: 1.1 },
    uahPrices: { standard: { month: 0, year: 0 }, professional: { month: 0, year: 0 } },
};

const SETTINGS_KEY = "payRequisites";
const ORDER_KEY = "billing:order";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : 0);

// ── проверки реквизитов ──────────────────────────────────────────────────────────────────────────────

/** IBAN по контрольной сумме mod 97 (ISO 13616): отсекает опечатки до того, как клиент отправит деньги не туда. */
export function validIban(raw: string): boolean {
    const iban = normalizeIban(raw);
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
    const moved = iban.slice(4) + iban.slice(0, 4);
    let rem = 0;
    for (const ch of moved) {
        const part = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
        for (const d of part) rem = (rem * 10 + Number(d)) % 97;
    }
    return rem === 1;
}

/** Адрес кошелька Tron (TRC-20): «T» + 33 символа base58. Полную контрольную сумму не считаем — формат достаточен, чтобы отсечь явный мусор. */
export const validTronAddress = (a: string) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a.trim());

/** Приводит присланное из формы к виду PayRequisites; бросает Error с понятным текстом, если что-то заполнено неверно. */
export function cleanRequisites(input: unknown): PayRequisites {
    const b = (input ?? {}) as Record<string, any>;
    const de = b.de ?? {}, ua = b.ua ?? {}, usdt = b.usdt ?? {}, prices = b.uahPrices ?? {};
    const out: PayRequisites = {
        de: { name: text(de.name, 100), address: text(de.address, 200), iban: normalizeIban(text(de.iban, 40)), bic: normalizeIban(text(de.bic, 12)), bank: text(de.bank, 100), vatId: text(de.vatId, 30), vatNote: text(de.vatNote, 200) },
        ua: { name: text(ua.name, 100), address: text(ua.address, 200), iban: normalizeIban(text(ua.iban, 40)), bank: text(ua.bank, 100), mfo: text(ua.mfo, 10), edrpou: text(ua.edrpou, 12), vatNote: text(ua.vatNote, 200) },
        usdt: { address: text(usdt.address, 60), network: "TRC-20", perEur: num(usdt.perEur) || 1.1 },
        uahPrices: {
            standard: { month: num(prices.standard?.month), year: num(prices.standard?.year) },
            professional: { month: num(prices.professional?.month), year: num(prices.professional?.year) },
        },
    };
    if (out.de.iban && !(out.de.iban.startsWith("DE") && validIban(out.de.iban))) throw new Error("German IBAN is invalid (check the characters)");
    if (out.ua.iban && !(out.ua.iban.startsWith("UA") && out.ua.iban.length === 29 && validIban(out.ua.iban))) throw new Error("Ukrainian IBAN is invalid (UA + 27 characters)");
    if (out.ua.edrpou && !/^\d{8,10}$/.test(out.ua.edrpou)) throw new Error("EDRPOU / tax number must be 8 to 10 digits");
    if (out.usdt.address && !validTronAddress(out.usdt.address)) throw new Error("USDT address must be a TRC-20 (Tron) address starting with T");
    return out;
}

export async function getRequisites(): Promise<PayRequisites> {
    const doc = await prisma.platformSettings.findUnique({ where: { key: SETTINGS_KEY } }).catch(() => null);
    if (!doc?.value) return EMPTY_REQUISITES;
    try {
        const v = JSON.parse(doc.value);
        return { ...EMPTY_REQUISITES, ...v, de: { ...EMPTY_REQUISITES.de, ...v.de }, ua: { ...EMPTY_REQUISITES.ua, ...v.ua }, usdt: { ...EMPTY_REQUISITES.usdt, ...v.usdt }, uahPrices: { ...EMPTY_REQUISITES.uahPrices, ...v.uahPrices } };
    } catch {
        return EMPTY_REQUISITES;
    }
}

export async function saveRequisites(input: unknown): Promise<PayRequisites> {
    const value = cleanRequisites(input);
    await prisma.platformSettings.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
    return value;
}

/** Что из способов оплаты готово для рынка: клиент видит только заполненное. */
export function readiness(r: PayRequisites, market: Market) {
    const bank = market === "DE" ? !!(r.de.name && r.de.iban) : !!(r.ua.name && r.ua.iban && r.ua.edrpou && r.uahPrices.standard.month && r.uahPrices.professional.month);
    return { bank, usdt: !!r.usdt.address };
}

// ── рынок и сумма ────────────────────────────────────────────────────────────────────────────────────

/** Рынок плательщика: страна из настроек бухгалтерии фирмы; не выбрана — по языку интерфейса (украинский → Украина, остальное → Германия). */
export async function marketForOrg(org: string, locale?: string): Promise<Market> {
    const s = await financeSettings(org).catch(() => null);
    return marketOf(s?.country) ?? (locale === "ua" ? "UA" : "DE");
}

export const currencyOf = (market: Market) => (market === "UA" ? "UAH" : "EUR");

export function planPriceEur(plan: PlanId, interval: Interval): number {
    const def = PLANS.find((p) => p.id === plan);
    return !def || def.priceMonth <= 0 ? 0 : def.priceMonth * (interval === "year" ? YEAR_MONTHS : 1);
}

/** Сумма к оплате в валюте рынка (₴ — из цен, заданных администратором) и в USDT (евро-цена × курс из реквизитов). */
export function amountsFor(r: PayRequisites, market: Market, plan: PlanId, interval: Interval) {
    const eur = planPriceEur(plan, interval);
    const uah = isPaidPlan(plan) ? r.uahPrices[plan][interval] : 0;
    return { eur, uah, usdt: Math.round(eur * r.usdt.perEur * 100) / 100, amount: market === "UA" ? uah : eur };
}

// ── QR-коды ──────────────────────────────────────────────────────────────────────────────────────────

const base64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** QR платёжной инструкции НБУ (формат BCD/002/UCT): приложения украинских банков по нему открывают готовый платёж. Ссылка bank.gov.ua/qr/… — штатный вид. */
export function nbuQrPayload(d: { name: string; iban: string; amount: number; edrpou: string; purpose: string }): string {
    const one = (v: string, max: number) => v.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
    const body = ["BCD", "002", "1", "UCT", "", one(d.name, 70), normalizeIban(d.iban), `UAH${(Math.round(d.amount * 100) / 100).toFixed(2)}`, d.edrpou, "", "", one(d.purpose, 140), ""].join("\n");
    return `https://bank.gov.ua/qr/${base64url(body)}`;
}

/** Содержимое QR для заказа: что именно отсканирует клиент. */
export function qrPayloadFor(o: Pick<Order, "method" | "market" | "amount" | "usdtAmount" | "number">, r: PayRequisites): string {
    if (o.method === "usdt") return r.usdt.address; // кошельки читают чистый адрес надёжнее, чем URI со схемой
    if (o.market === "UA") return nbuQrPayload({ name: r.ua.name, iban: r.ua.iban, amount: o.amount, edrpou: r.ua.edrpou, purpose: `Оплата рахунку ${o.number}` });
    return epcPayload({ name: r.de.name, iban: r.de.iban, bic: r.de.bic, amount: o.amount, remittance: `${o.number} Firmspace CRM` });
}

/** QR как готовый SVG: рисуется на сервере, клиент вставляет как есть (в нём нет пользовательского текста — только фигуры). */
export function qrSvg(payload: string): string {
    const m = qrMatrix(payload);
    const quiet = 2, n = m.size + quiet * 2;
    let d = "";
    for (let r = 0; r < m.size; r++) {
        let c = 0;
        while (c < m.size) {
            if (!m.isDark(r, c)) { c++; continue; }
            let end = c;
            while (end + 1 < m.size && m.isDark(r, end + 1)) end++;
            d += `M${c + quiet} ${r + quiet}h${end - c + 1}v1h-${end - c + 1}z`;
            c = end + 1;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ── заказы ───────────────────────────────────────────────────────────────────────────────────────────

export interface Order {
    id: string;
    org: string;
    number: string;
    plan: "standard" | "professional";
    interval: Interval;
    method: Method;
    market: Market;
    currency: string; // валюта счёта: EUR или UAH
    amount: number; // в валюте счёта (для USDT — евро/гривневый эквивалент, фактически платится usdtAmount)
    usdtAmount: number;
    company: string;
    vatId: string;
    status: OrderStatus;
    payerRef: string; // что написал клиент при «я оплатил»: хэш транзакции, дата, имя плательщика
    createdAt: string;
    claimedAt: string;
    paidAt: string;
}

const toOrder = (r: { id: string; org: string; rid: string; values: unknown; createdAt: Date }): Order => ({ id: r.rid, org: r.org, ...(r.values as object) } as Order);

export async function listOrders(org?: string, statuses?: OrderStatus[]): Promise<Order[]> {
    const rows = await prisma.sectionRecord.findMany({ where: { key: ORDER_KEY, ...(org ? { org } : {}) }, orderBy: { createdAt: "desc" }, take: 200 });
    const all = rows.map(toOrder);
    return statuses ? all.filter((o) => statuses.includes(o.status)) : all;
}

export async function findOrder(id: string, org?: string): Promise<Order | null> {
    const row = await prisma.sectionRecord.findFirst({ where: { key: ORDER_KEY, rid: id, ...(org ? { org } : {}) } });
    return row ? toOrder(row) : null;
}

async function saveOrder(o: Order) {
    const { id, org, ...values } = o;
    const row = await prisma.sectionRecord.findFirst({ where: { key: ORDER_KEY, rid: id, org } });
    if (!row) throw new Error("Order not found");
    await prisma.sectionRecord.update({ where: { id: row.id }, data: { values: values as never } });
}

export class OrderError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}

export async function createOrder(org: string, input: { plan: unknown; interval: unknown; method: unknown; company: unknown; vatId?: unknown; locale?: string }): Promise<Order> {
    if (!isPaidPlan(input.plan) || (input.interval !== "month" && input.interval !== "year")) throw new OrderError("Invalid plan");
    if (input.method !== "bank" && input.method !== "usdt") throw new OrderError("Invalid payment method");
    const company = text(input.company, 200);
    if (!company) throw new OrderError("Company name and address are required");
    const market = await marketForOrg(org, input.locale);
    const r = await getRequisites();
    const ready = readiness(r, market);
    if (!ready[input.method]) throw new OrderError("This payment method is not available yet", 503);
    // один открытый заказ на тариф и срок: повторное нажатие возвращает его, а не плодит счета
    const open = (await listOrders(org, ["new", "claimed"])).find((o) => o.plan === input.plan && o.interval === input.interval && o.method === input.method && o.market === market);
    if (open) return open;
    const a = amountsFor(r, market, input.plan, input.interval);
    if (!a.amount) throw new OrderError("The price for this plan is not set yet", 503);
    const year = new Date().getFullYear();
    const seq = (await prisma.sectionRecord.count({ where: { key: ORDER_KEY } })) + 1;
    const order: Order = {
        id: randomToken(10), org, number: `FS-${year}-${String(seq).padStart(4, "0")}`, plan: input.plan, interval: input.interval, method: input.method, market,
        currency: currencyOf(market), amount: a.amount, usdtAmount: a.usdt, company, vatId: text(input.vatId, 40), status: "new", payerRef: "",
        createdAt: new Date().toISOString(), claimedAt: "", paidAt: "",
    };
    const { id, org: o, ...values } = order;
    await prisma.sectionRecord.create({ data: { org: o, key: ORDER_KEY, rid: id, values: values as never } });
    return order;
}

/** Клиент нажал «Я оплатил»: заказ уходит в очередь администратора. Подробности (хэш, дата) нужны, чтобы найти поступление. */
export async function claimOrder(id: string, org: string, payerRef: string): Promise<Order> {
    const o = await findOrder(id, org);
    if (!o) throw new OrderError("Order not found", 404);
    if (o.status === "paid") return o;
    if (o.status === "cancelled") throw new OrderError("Order is cancelled", 409);
    const next: Order = { ...o, status: "claimed", payerRef: text(payerRef, 300), claimedAt: new Date().toISOString() };
    await saveOrder(next);
    return next;
}

/** Деньги поступили — включаем тариф. Продление считается от конца действующего срока того же тарифа; повторное подтверждение ничего не удваивает. */
export async function confirmOrder(id: string): Promise<Order> {
    const o = await findOrder(id);
    if (!o) throw new OrderError("Order not found", 404);
    if (o.status === "paid") return o;
    const org = await prisma.organization.findUnique({ where: { id: o.org } });
    if (!org) throw new OrderError("Organization not found", 404);
    const now = new Date();
    const until = org.planOverride === o.plan && org.planOverrideUntil && org.planOverrideUntil > now ? new Date(org.planOverrideUntil) : now;
    if (o.interval === "year") until.setFullYear(until.getFullYear() + 1); else until.setMonth(until.getMonth() + 1);
    await prisma.organization.update({ where: { id: org.id }, data: { planOverride: o.plan, planOverrideUntil: until } });
    const next: Order = { ...o, status: "paid", paidAt: now.toISOString() };
    await saveOrder(next);
    return next;
}

export async function cancelOrder(id: string): Promise<Order> {
    const o = await findOrder(id);
    if (!o) throw new OrderError("Order not found", 404);
    if (o.status === "paid") throw new OrderError("A paid order cannot be cancelled", 409);
    const next: Order = { ...o, status: "cancelled" };
    await saveOrder(next);
    return next;
}

// ── то, что видит клиент ─────────────────────────────────────────────────────────────────────────────

export interface OrderView {
    order: Order;
    seller: { name: string; address: string; taxId: string; note: string };
    /** Строки «подпись → значение» для блока оплаты: получатель, IBAN, сумма, назначение… */
    lines: { label: string; value: string }[];
    payTo: string; // сумма словами «49,00 EUR» или «53,90 USDT»
    qr: string; // SVG
    qrText: string; // что зашито в код — для подписи под ним и для PDF
}

const money = (n: number, cur: string) => `${n.toFixed(2)} ${cur}`;

/** Реквизиты платежа по заказу на языке рынка (DE → немецкий, UA → украинский). Реквизиты берутся из актуальных настроек. */
export function orderView(o: Order, r: PayRequisites): OrderView {
    const ua = o.market === "UA";
    const L = ua
        ? { recipient: "Отримувач", iban: "IBAN", bic: "МФО", bank: "Банк", edrpou: "ЄДРПОУ", amount: "Сума", purpose: "Призначення платежу", purposeText: `Оплата рахунку ${o.number}`, wallet: "Гаманець USDT", network: "Мережа", note: "Переказуйте рівно вказану суму в USDT мережі TRC-20 — інші мережі не зараховуються." }
        : { recipient: "Empfänger", iban: "IBAN", bic: "BIC", bank: "Bank", edrpou: "", amount: "Betrag", purpose: "Verwendungszweck", purposeText: `${o.number} Firmspace CRM`, wallet: "USDT-Wallet", network: "Netzwerk", note: "Bitte genau den angegebenen Betrag in USDT über das Netzwerk TRC-20 senden — andere Netzwerke werden nicht gutgeschrieben." };
    const payload = qrPayloadFor(o, r);
    const seller = ua
        ? { name: r.ua.name, address: r.ua.address, taxId: r.ua.edrpou ? `${L.edrpou} ${r.ua.edrpou}` : "", note: r.ua.vatNote }
        : { name: r.de.name, address: r.de.address, taxId: r.de.vatId ? `USt-IdNr. ${r.de.vatId}` : "", note: r.de.vatNote };
    if (o.method === "usdt") {
        return {
            order: o, seller, payTo: money(o.usdtAmount, "USDT"), qr: qrSvg(payload), qrText: r.usdt.address,
            lines: [{ label: L.wallet, value: r.usdt.address }, { label: L.network, value: r.usdt.network }, { label: L.amount, value: money(o.usdtAmount, "USDT") }, { label: "", value: L.note }],
        };
    }
    const bank = ua
        ? [{ label: L.recipient, value: r.ua.name }, { label: L.iban, value: r.ua.iban }, ...(r.ua.bank ? [{ label: L.bank, value: r.ua.bank }] : []), ...(r.ua.mfo ? [{ label: L.bic, value: r.ua.mfo }] : [])]
        : [{ label: L.recipient, value: r.de.name }, { label: L.iban, value: r.de.iban }, ...(r.de.bic ? [{ label: L.bic, value: r.de.bic }] : []), ...(r.de.bank ? [{ label: L.bank, value: r.de.bank }] : [])];
    return {
        order: o, seller, payTo: money(o.amount, o.currency), qr: qrSvg(payload), qrText: "",
        lines: [...bank, { label: L.amount, value: money(o.amount, o.currency) }, { label: L.purpose, value: L.purposeText }],
    };
}

/** Сообщение администратору платформы в Telegram (бот отчётов, если подключён): «клиент заявил об оплате». Сбой не мешает запросу. */
export async function notifyClaim(o: Order, orgName: string): Promise<void> {
    try {
        const [{ errorBot }, { sendTelegram }] = await Promise.all([import("@/lib/platformSettings"), import("@/lib/channels/telegram")]);
        const bot = await errorBot();
        if (!bot.botToken || !bot.chatId) return;
        const sum = o.method === "usdt" ? `${o.usdtAmount.toFixed(2)} USDT` : `${o.amount.toFixed(2)} ${o.currency}`;
        await sendTelegram(bot.botToken, bot.chatId, `💶 Заявлена оплата тарифа\n${orgName} · ${o.plan} / ${o.interval}\nСчёт ${o.number}: ${sum}${o.payerRef ? `\n${o.payerRef}` : ""}\nПодтвердите в админ-панели после проверки поступления.`);
    } catch { /* уведомление необязательно */ }
}
