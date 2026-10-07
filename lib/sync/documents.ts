import { logActivity, type FeedKind } from "@/lib/sync/feed";

// Событие документа (счёт, КП, заказ, договор) в ленту сделки, контакта и фирмы, к которым документ привязан.
// Один вызов в каждом месте, где документ создаётся, уходит клиенту, принимается или подписывается, — и из
// маршрутов, и из действий ассистента: карточка клиента одинаково показывает всё, как бы действие ни было сделано.
export async function logDocEvent(
    org: string,
    doc: { id: string; deal?: string | null; contact?: string | null; company?: string | null },
    kind: Extract<FeedKind, "invoice" | "quote" | "contract" | "order">,
    text: string,
    key: string,
) {
    await logActivity(org, { deal: doc.deal, contact: doc.contact, company: doc.company }, { type: kind, text, meta: `${kind}:${doc.id}`, key: `${kind}:${doc.id}:${key}` });
}
