import { randomToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { financeSettings } from "@/lib/finance/settings";
import { marketOf } from "@/lib/finance/market";

// Публичные ссылки для клиента: статус заказа и принятие предложения. Ссылка даёт ровно один документ
// и ничего больше. Токен случайный и длинный, отозвать можно в любой момент, срок жизни ограничен (по умолчанию 90 дней).

export const SHARE_DAYS = 90;

export async function shareLink(org: string, kind: "order" | "quote", ref: string, author?: string) {
    const existing = await prisma.shareLink.findFirst({ where: { org, kind, ref } });
    if (existing && (!existing.expiresAt || existing.expiresAt.getTime() > Date.now())) return existing;
    const data = {
        token: randomToken(24),
        expiresAt: new Date(Date.now() + SHARE_DAYS * 24 * 60 * 60 * 1000),
        views: 0,
        createdByName: author ?? "",
    };
    return existing
        ? prisma.shareLink.update({ where: { id: existing.id }, data })
        : prisma.shareLink.create({ data: { org, kind, ref, ...data } });
}

export async function revokeShare(org: string, kind: "order" | "quote", ref: string): Promise<void> {
    await prisma.shareLink.deleteMany({ where: { org, kind, ref } });
}

export interface ShareItem { name: string; qty: number; price: number }
export interface ShareView {
    kind: "order" | "quote";
    market: "DE" | "UA";
    contract: string;
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
    const link = await prisma.shareLink.findFirst({ where: { token } });
    if (!link) return null;
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
    await prisma.shareLink.update({ where: { id: link.id }, data: { views: (Number(link.views) || 0) + 1, lastViewAt: new Date() } });

    const org = String(link.org);
    const settings = await financeSettings(org);
    const company = {
        name: settings.legalName || "",
        phone: settings.phone || "",
        email: settings.email || "",
        site: settings.website || "",
        logo: settings.logo || "",
    };

    const market = marketOf(settings.country) ?? "DE";

    if (link.kind === "order") {
        const order = await prisma.order.findFirst({ where: { id: link.ref, org } });
        if (!order) return null;
        const invoice = order.invoice ? await prisma.invoice.findFirst({ where: { id: order.invoice, org } }) : null;
        const waybillRaw = order.waybill as any;
        const ukrposhta = order.ukrposhta as any;
        const waybill = waybillRaw?.number
            ? { carrier: "Нова Пошта", number: String(waybillRaw.number), status: String(waybillRaw.status ?? "") }
            : ukrposhta?.barcode
              ? { carrier: "Укрпошта", number: String(ukrposhta.barcode), status: String(ukrposhta.status ?? "") }
              : null;
        return {
            kind: "order",
            market,
            contract: order.contract ? String(order.contract) : "",
            company,
            number: String(order.number ?? ""),
            status: String(order.status ?? ""),
            customer: String(order.customerName ?? ""),
            currency: String(order.currency ?? ""),
            items: ((order.items as any[]) ?? []).map((i: { description?: string; qty?: number; unitPrice?: number }) => ({ name: String(i.description ?? ""), qty: Number(i.qty) || 0, price: Number(i.unitPrice) || 0 })),
            validUntil: "",
            createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : "",
            delivery: waybill,
            // Оплата: если счёт уже оплачен — так и пишем; если нет, клиент может заплатить по ссылке
            payment: invoice ? { number: String(invoice.number ?? ""), paid: invoice.status === "paid", url: String((invoice.payLink as any)?.url ?? "") } : null,
        };
    }

    const quote = await prisma.quote.findFirst({ where: { id: link.ref, org } });
    if (!quote) return null;
    return {
        kind: "quote",
        market,
        // у предложения поля договора в модели нет — печатаем пустую строку, как и раньше
        contract: String((quote as any).contract ?? ""),
        company,
        number: String(quote.number ?? ""),
        status: String(quote.status ?? ""),
        customer: String(quote.customerName ?? ""),
        currency: String(quote.currency ?? ""),
        items: ((quote.items as any[]) ?? []).map((i: { description?: string; qty?: number; unitPrice?: number }) => ({ name: String(i.description ?? ""), qty: Number(i.qty) || 0, price: Number(i.unitPrice) || 0 })),
        validUntil: String(quote.validUntil ?? ""),
        createdAt: quote.createdAt ? new Date(quote.createdAt).toISOString() : "",
        delivery: null,
        payment: null,
    };
}

/** Принятие предложения клиентом: пишем в само предложение, что и когда клиент выбрал */
export async function acceptQuote(token: string, picked: number[]): Promise<{ ok: boolean; message: string }> {
    const link = await prisma.shareLink.findFirst({ where: { token } });
    if (!link || link.kind !== "quote") return { ok: false, message: "Посилання не знайдено" };
    if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return { ok: false, message: "Термін дії посилання минув" };
    const quote = await prisma.quote.findFirst({ where: { id: link.ref, org: link.org } });
    if (!quote) return { ok: false, message: "Пропозицію не знайдено" };
    if (quote.status === "accepted") return { ok: true, message: "Уже прийнято" };
    const data: Record<string, any> = { status: "accepted" };
    // Клиент мог отметить только часть позиций — оставляем выбранные, остальные убираем
    if (Array.isArray(picked) && picked.length) {
        const items = ((quote.items as any[]) ?? []).filter((_: unknown, i: number) => picked.includes(i));
        if (items.length) data.items = items;
    }
    await prisma.quote.update({ where: { id: quote.id }, data });
    return { ok: true, message: "Прийнято" };
}
