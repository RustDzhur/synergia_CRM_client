import type { HydratedDocument } from "mongoose";
import { randomToken } from "@/lib/crypto";
import Invoice from "@/models/Invoice";
import Order from "@/models/Order";
import Quote from "@/models/Quote";
import ShareLink from "@/models/ShareLink";
import { financeSettings } from "@/lib/finance/settings";

// Публичные ссылки для клиента: статус заказа и принятие предложения. Ссылка даёт ровно один документ
// и ничего больше — ни кабинета, ни других клиентов, ни настроек. Токен случайный и длинный, отозвать
// можно в любой момент, а срок жизни ограничен (по умолчанию 90 дней).

type Doc = HydratedDocument<any>;

export const SHARE_DAYS = 90;

export async function shareLink(org: string, kind: "order" | "quote", ref: string, author?: string): Promise<Doc> {
    const existing = await ShareLink.findOne({ org, kind, ref });
    if (existing && (!existing.expiresAt || existing.expiresAt.getTime() > Date.now())) return existing;
    const doc = existing ?? new ShareLink({ org, kind, ref });
    doc.token = randomToken(24);
    doc.expiresAt = new Date(Date.now() + SHARE_DAYS * 24 * 60 * 60 * 1000);
    doc.views = 0;
    doc.createdByName = author ?? "";
    await doc.save();
    return doc;
}

export async function revokeShare(org: string, kind: "order" | "quote", ref: string): Promise<void> {
    await ShareLink.deleteOne({ org, kind, ref });
}

export interface ShareItem { name: string; qty: number; price: number }
export interface ShareView {
    kind: "order" | "quote";
    company: { name: string; phone: string; email: string; site: string; logo: string };
    number: string;
    status: string;
    customer: string;
    currency: string;
    items: ShareItem[];
    validUntil: string;
    createdAt: string;
    delivery: { carrier: string; number: string; status: string } | null;
    payment: { number: string; paid: boolean; url: string } | null;
}

/** Что показывает публичная страница: только то, что не стыдно показать клиенту */
export async function shareData(token: string): Promise<ShareView | null> {
    const link = await ShareLink.findOne({ token });
    if (!link) return null;
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
    await ShareLink.updateOne({ _id: link._id }, { $inc: { views: 1 }, $set: { lastViewAt: new Date() } });

    const org = String(link.org);
    const settings = await financeSettings(org);
    const company = {
        name: settings.legalName || "",
        phone: settings.phone || "",
        email: settings.email || "",
        site: settings.website || "",
        logo: settings.logo || "",
    };

    if (link.kind === "order") {
        const order = await Order.findOne({ _id: link.ref, org });
        if (!order) return null;
        const invoice = order.invoice ? await Invoice.findOne({ _id: order.invoice, org }) : null;
        const waybill = order.waybill?.number
            ? { carrier: "Нова Пошта", number: String(order.waybill.number), status: String(order.waybill.status ?? "") }
            : order.ukrposhta?.barcode
              ? { carrier: "Укрпошта", number: String(order.ukrposhta.barcode), status: String(order.ukrposhta.status ?? "") }
              : null;
        return {
            kind: "order",
            company,
            number: String(order.number ?? ""),
            status: String(order.status ?? ""),
            customer: String(order.customerName ?? ""),
            currency: String(order.currency ?? ""),
            items: (order.items ?? []).map((i: { description?: string; qty?: number; unitPrice?: number }) => ({ name: String(i.description ?? ""), qty: Number(i.qty) || 0, price: Number(i.unitPrice) || 0 })),
            validUntil: "",
            createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : "",
            delivery: waybill,
            // Оплата: если счёт уже оплачен — так и пишем; если нет, клиент может заплатить по ссылке
            payment: invoice ? { number: String(invoice.number ?? ""), paid: invoice.status === "paid", url: invoice.payLink?.url ?? "" } : null,
        };
    }

    const quote = await Quote.findOne({ _id: link.ref, org });
    if (!quote) return null;
    return {
        kind: "quote",
        company,
        number: String(quote.number ?? ""),
        status: String(quote.status ?? ""),
        customer: String(quote.customerName ?? ""),
        currency: String(quote.currency ?? ""),
        items: (quote.items ?? []).map((i: { description?: string; qty?: number; unitPrice?: number }) => ({ name: String(i.description ?? ""), qty: Number(i.qty) || 0, price: Number(i.unitPrice) || 0 })),
        validUntil: String(quote.validUntil ?? ""),
        createdAt: quote.createdAt ? new Date(quote.createdAt).toISOString() : "",
        delivery: null,
        payment: null,
    };
}

/** Принятие предложения клиентом: пишем в само предложение, что и когда клиент выбрал */
export async function acceptQuote(token: string, picked: number[]): Promise<{ ok: boolean; message: string }> {
    const link = await ShareLink.findOne({ token });
    if (!link || link.kind !== "quote") return { ok: false, message: "Посилання не знайдено" };
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { ok: false, message: "Термін дії посилання минув" };
    const quote = await Quote.findOne({ _id: link.ref, org: link.org });
    if (!quote) return { ok: false, message: "Пропозицію не знайдено" };
    if (quote.status === "accepted") return { ok: true, message: "Уже прийнято" };
    // Клиент мог отметить только часть позиций — оставляем выбранные, остальные убираем
    if (Array.isArray(picked) && picked.length) {
        const items = (quote.items ?? []).filter((_: unknown, i: number) => picked.includes(i));
        if (items.length) quote.items = items as never;
    }
    quote.status = "accepted";
    await quote.save();
    return { ok: true, message: "Прийнято" };
}
