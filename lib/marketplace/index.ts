import type { HydratedDocument } from "mongoose";
import { ProviderError, fetchProvider } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import Contact from "@/models/Contact";
import Deal from "@/models/Deal";
import Stage from "@/models/Stage";
import User from "@/models/User";

// Маркетплейсы: заказы и заявки с Prom.ua, Rozetka, Horoshop и OLX попадают в воронку сами.
// Приведённые к общему виду заказы разбирают адаптеры рядом; здесь — общая часть: сохранить
// контакт, найти этап, создать сделку и не сделать этого дважды.
//
// Ответы маркетплейсов разбираются терпимо к названиям полей: у площадок они отличаются и меняются,
// а нам важно вытащить номер заказа, покупателя, телефон и сумму. Если чего-то нет — заявка всё
// равно создаётся: потерять лид хуже, чем показать его без суммы.

export type MarketplaceId = "prom" | "rozetka" | "horoshop" | "olx";

export const MARKETPLACES: Record<MarketplaceId, { label: string }> = {
    prom: { label: "Prom.ua" },
    rozetka: { label: "Rozetka" },
    horoshop: { label: "Horoshop" },
    olx: { label: "OLX" },
};

export interface MarketOrder {
    externalId: string;
    at: Date;
    customerName: string;
    phone: string;
    email: string;
    amount: number;
    currency: string;
    items: { name: string; qty: number; price: number }[];
    status: string;
    note: string;
}

export type Doc = HydratedDocument<any>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number => {
    const n = Number(typeof v === "string" ? v.replace(/\s/g, "").replace(",", ".") : v);
    return Number.isFinite(n) ? n : 0;
};
const pick = (obj: Record<string, unknown> | undefined, keys: string[]): unknown => {
    if (!obj) return undefined;
    for (const k of keys) {
        const v = obj[k];
        if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
};
const date = (v: unknown): Date => {
    const s = str(v);
    const d = s ? new Date(s.replace(" ", "T")) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
};
const items = (list: unknown): MarketOrder["items"] =>
    (Array.isArray(list) ? list : []).map((raw) => {
        const it = raw as Record<string, unknown>;
        return {
            name: str(pick(it, ["name", "product_name", "title", "sku"])).slice(0, 200) || "Товар",
            qty: num(pick(it, ["quantity", "qty", "count", "amount"])) || 1,
            price: num(pick(it, ["price", "price_uah", "cost", "unit_price"])),
        };
    });

// ── Адаптеры ────────────────────────────────────────────────────────────────────────────────────────
// У каждой площадки свои адрес, способ входа и форма ответа. Все они отдают один и тот же MarketOrder,
// поэтому дальше код общий.

async function promOrders(token: string, since: Date): Promise<MarketOrder[]> {
    const res = await fetchProvider("https://my.prom.ua/api/v1/orders/list", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ limit: 100, date_from: since.toISOString().slice(0, 10) }),
    });
    const json = (await res.json().catch(() => null)) as { orders?: Record<string, unknown>[] } | null;
    if (!res.ok || !json) throw new ProviderError(`Prom.ua ответил ошибкой ${res.status}`);
    return (json.orders ?? []).map((o) => {
        const customer = (o.customer ?? {}) as Record<string, unknown>;
        return {
            externalId: str(pick(o, ["id", "order_id"])),
            at: date(pick(o, ["date_created", "created_at", "date"])),
            customerName: str(pick(customer, ["name", "title"])).slice(0, 200) || "Покупець Prom.ua",
            phone: str(pick(customer, ["phone", "phone_number"])),
            email: str(pick(customer, ["email"])),
            amount: num(pick(o, ["price", "total_price", "amount"])),
            currency: str(pick(o, ["currency"])) || "UAH",
            items: items(pick(o, ["products", "items"])),
            status: str(pick(o, ["status_name", "status"])),
            note: str(pick(o, ["customer_note", "comment"])).slice(0, 500),
        };
    });
}

async function rozetkaOrders(token: string, since: Date): Promise<MarketOrder[]> {
    const q = new URLSearchParams({ page: "1", "created_from": since.toISOString().slice(0, 10) });
    const res = await fetchProvider(`https://api-seller.rozetka.com.ua/orders/search?${q}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const json = (await res.json().catch(() => null)) as { content?: { orders?: Record<string, unknown>[] }; orders?: Record<string, unknown>[] } | null;
    if (!res.ok || !json) throw new ProviderError(`Rozetka ответила ошибкой ${res.status}`);
    const list = json.content?.orders ?? json.orders ?? [];
    return list.map((o) => {
        const customer = (o.customer ?? {}) as Record<string, unknown>;
        return {
            externalId: str(pick(o, ["id", "order_id"])),
            at: date(pick(o, ["created", "created_at", "date"])),
            customerName: str(pick(customer, ["name", "title", "full_name"])).slice(0, 200) || str(pick(o, ["customer_name"])).slice(0, 200) || "Покупець Rozetka",
            phone: str(pick(customer, ["phone"])) || str(pick(o, ["phone", "recipient_phone"])),
            email: str(pick(customer, ["email"])) || str(pick(o, ["email"])),
            amount: num(pick(o, ["amount", "total", "price", "cost"])),
            currency: str(pick(o, ["currency"])) || "UAH",
            items: items(pick(o, ["items", "products", "ordered_items"])),
            status: str(pick(o, ["status", "status_name"])),
            note: str(pick(o, ["comment", "customer_comment"])).slice(0, 500),
        };
    });
}

// Horoshop: у каждого магазина свой поддомен — адрес спрашиваем при подключении
async function horoshopOrders(doc: Doc, since: Date): Promise<MarketOrder[]> {
    const shop = str(doc.config?.shop).replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const secrets = secretsOf<{ login?: string; password?: string }>(doc);
    if (!shop) throw new ProviderError("Укажите адрес магазина Horoshop (например shop.horoshop.ua)");
    const res = await fetchProvider(`https://${shop}/api/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: secrets.login ?? "", password: secrets.password ?? "", date_from: since.toISOString().slice(0, 10) }),
    });
    const json = (await res.json().catch(() => null)) as { response?: { orders?: Record<string, unknown>[] }; orders?: Record<string, unknown>[] } | null;
    if (!res.ok || !json) throw new ProviderError(`Horoshop ответил ошибкой ${res.status}`);
    const list = json.response?.orders ?? json.orders ?? [];
    return list.map((o) => {
        const customer = (o.customer ?? o.contacts ?? {}) as Record<string, unknown>;
        return {
            externalId: str(pick(o, ["order_id", "id", "number"])),
            at: date(pick(o, ["date", "created", "created_at"])),
            customerName: str(pick(customer, ["name", "fio", "full_name"])).slice(0, 200) || "Покупець Horoshop",
            phone: str(pick(customer, ["phone", "telephone"])) || str(pick(o, ["phone"])),
            email: str(pick(customer, ["email"])),
            amount: num(pick(o, ["total", "amount", "price", "summ"])),
            currency: str(pick(o, ["currency"])) || "UAH",
            items: items(pick(o, ["products", "items", "cart"])),
            status: str(pick(o, ["status_name", "status"])),
            note: str(pick(o, ["comment", "note"])).slice(0, 500),
        };
    });
}

// OLX: у объявлений нет «заказов», заявка — это первое сообщение в чате по объявлению.
// Partner API требует приложение-партнёр OLX и вход по client_credentials.
async function olxLeads(doc: Doc, since: Date): Promise<MarketOrder[]> {
    const secrets = secretsOf<{ clientId?: string; clientSecret?: string }>(doc);
    const tokenRes = await fetchProvider("https://www.olx.ua/api/partner/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: secrets.clientId ?? "",
            client_secret: secrets.clientSecret ?? "",
            scope: "read",
        }).toString(),
    });
    const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null;
    if (!tokenRes.ok || !tokenJson?.access_token) throw new ProviderError("OLX не выдал токен — проверьте Client ID и Secret (нужно приложение партнёра OLX)");
    const res = await fetchProvider(`https://www.olx.ua/api/partner/threads?limit=50&offset=0`, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const json = (await res.json().catch(() => null)) as { data?: Record<string, unknown>[] } | null;
    if (!res.ok || !json) throw new ProviderError(`OLX ответил ошибкой ${res.status}`);
    return (json.data ?? []).map((t) => ({
        externalId: str(pick(t, ["id"])),
        at: date(pick(t, ["created_time", "created_at"])),
        customerName: str(pick(t, ["interlocutor_name", "name"])).slice(0, 200) || "Клієнт OLX",
        phone: "",
        email: "",
        amount: 0,
        currency: "UAH",
        items: [],
        status: "Нова заявка",
        note: str(pick(t, ["last_message", "message"])).slice(0, 500),
    })).filter((o) => o.externalId && o.at >= since);
}

export async function pullOrders(doc: Doc, since: Date): Promise<MarketOrder[]> {
    const secrets = secretsOf<{ token?: string }>(doc);
    const type = String(doc.type) as MarketplaceId;
    if (type === "prom") return promOrders(String(secrets.token ?? ""), since);
    if (type === "rozetka") return rozetkaOrders(String(secrets.token ?? ""), since);
    if (type === "horoshop") return horoshopOrders(doc, since);
    if (type === "olx") return olxLeads(doc, since);
    throw new ProviderError("Неизвестная площадка");
}

// ── Сохранение в CRM ────────────────────────────────────────────────────────────────────────────────

// Контакт ищем по телефону или почте: у маркетплейсов покупатель — это телефон, а не имя
async function contactFor(org: string, order: MarketOrder, source: MarketplaceId) {
    const digits = order.phone.replace(/\D/g, "");
    let contact = digits.length >= 9 ? await Contact.findOne({ owner: org, phone: { $regex: digits.slice(-9) } }) : null;
    if (!contact && order.email) contact = await Contact.findOne({ owner: org, email: order.email });
    if (contact) return contact;
    return Contact.create({
        owner: org,
        name: order.customerName,
        phone: order.phone,
        email: order.email,
        source,
    }).catch(() => null);
}

/** Импорт заказов площадки: создаёт сделки в первой колонке воронки и не дублирует уже привезённые */
export async function importOrders(org: string, source: MarketplaceId, orders: MarketOrder[], opts: { commissionPercent?: number } = {}): Promise<{ created: number; skipped: number }> {
    if (!orders.length) return { created: 0, skipped: 0 };
    const known = new Set(
        (await Deal.find({ owner: org, source, externalId: { $in: orders.map((o) => o.externalId) } }).select("externalId").lean<{ externalId?: string }[]>()).map((d) => String(d.externalId ?? ""))
    );
    const stage = await Stage.findOne({ owner: org }).sort({ order: 1 });
    if (!stage) throw new ProviderError("В воронке нет ни одной колонки — сначала создайте этап в разделе CRM");
    let created = 0;
    let skipped = 0;
    for (const order of orders) {
        if (!order.externalId || known.has(order.externalId)) {
            skipped += 1;
            continue;
        }
        const contact = await contactFor(org, order, source);
        const count = await Deal.countDocuments({ owner: org, stage: stage._id });
        const label = MARKETPLACES[source].label;
        await Deal.create({
            owner: org,
            stage: stage._id,
            clientName: order.customerName,
            order: count,
            contact: contact?._id,
            contactName: order.customerName,
            source,
            externalId: order.externalId,
            // Состав и сумма заявки — чтобы из сделки можно было одним действием собрать заказ, счёт и ТТН
            market: { amount: order.amount, currency: order.currency, items: order.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })), commission: Number(opts.commissionPercent) || 0 },
            responsible: "",
            activities: [
                { type: "created", text: order.customerName },
                {
                    type: "note",
                    text: [`Заявка з ${label} №${order.externalId}`, order.amount ? `Сума: ${order.amount} ${order.currency}` : "", order.status ? `Статус: ${order.status}` : "", order.note].filter(Boolean).join(" · "),
                },
            ],
        });
        created += 1;
    }
    return { created, skipped };
}

/** Синхронизация всех подключённых площадок: одна недоступная не мешает остальным */
export async function syncMarketplaces(org: string, sinceDays = 30): Promise<{ provider: string; created: number; skipped: number; error?: string }[]> {
    const { default: Integration } = await import("@/models/Integration");
    const docs = await Integration.find({ owner: org, type: { $in: Object.keys(MARKETPLACES) }, status: "connected" });
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const out: { provider: string; created: number; skipped: number; error?: string }[] = [];
    for (const doc of docs) {
        try {
            const orders = await pullOrders(doc, since);
            const { created, skipped } = await importOrders(org, doc.type as MarketplaceId, orders, { commissionPercent: Number(doc.config?.commission) || 0 });
            doc.error = "";
            await doc.save();
            out.push({ provider: doc.type, created, skipped });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Не удалось получить заказы";
            doc.error = message.slice(0, 300);
            await doc.save();
            out.push({ provider: doc.type, created: 0, skipped: 0, error: message });
        }
    }
    return out;
}

/** Проверка подключения: тянем один заказ и показываем, что площадка ответила — по этому видно,
 *  верный ли токен и те ли поля приходят */
export async function checkMarketplace(doc: Doc): Promise<{ ok: boolean; sample: MarketOrder | null; message: string }> {
    try {
        const orders = await pullOrders(doc, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const sample = orders[0] ?? null;
        return { ok: true, sample, message: orders.length ? `Заказов за неделю: ${orders.length}` : "Заказов за неделю нет — подключение работает" };
    } catch (e) {
        return { ok: false, sample: null, message: e instanceof Error ? e.message : "Проверка не удалась" };
    }
}

export { User };
