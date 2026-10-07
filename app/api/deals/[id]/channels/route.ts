import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { mailboxCanSend, sendFromAccount } from "@/lib/mail";
import { sendToConversation } from "@/lib/channels";
import { mailAccount, resolveRecipient } from "@/lib/finance/send";
import { invoicePdfBuffer, orderPdfBuffer, quotePdfBuffer } from "@/lib/finance/document";
import { prisma } from "@/lib/prisma";
import { dealScope } from "@/lib/sync/people";

export const dynamic = "force-dynamic";

// Отправка из карточки сделки: SMS, Viber, Telegram и письмо.
//
// GET  — что доступно по этой сделке: клиент показывает подсказку под вкладкой, а не молчит
// POST — { channel, text }: отправить и записать это же в ленту активности сделки
//
// Куда уходит сообщение. Telegram и Viber не позволяют написать первым: бот может ответить только
// тому, кто уже написал ему. Поэтому там мы ищем существующую переписку с этим контактом, а если её
// нет — честно говорим об этом. SMS и почта инициируются с нашей стороны: для SMS нужен телефон
// контакта и подключённый провайдер, для письма — адрес и ящик фирмы.

type Channel = "sms" | "viber" | "telegram" | "whatsapp" | "email";
// Что показать пользователю: ready — можно отправлять, остальное — причина, по которой нельзя
type Availability = "ready" | "no_provider" | "no_phone" | "no_recipient" | "no_mailbox" | "no_send_scope" | "no_conversation" | "no_contact";
// Контакт сделки: id вместо прежнего _id (Prisma)
type ContactRef = { id: string; name: string | null; phone: string | null } | null;

const CHANNELS: Channel[] = ["sms", "viber", "telegram", "whatsapp", "email"];
const SMS_TYPES = ["twilio", "vonage", "plivo", "telnyx"];
// Провайдеры, которые шлют SMS: у Twilio это ещё и звонки, поэтому отдельного типа «sms» нет
const digits = (v: string) => v.replace(/\D/g, "");

async function loadDeal(org: string, id: string, scope: Record<string, unknown> = {}) {
    const deal = await prisma.deal.findFirst({ where: { id, owner: org, ...scope } });
    if (!deal) return null;
    const contact = deal.contact
        ? await prisma.contact.findFirst({ where: { id: String(deal.contact), owner: org }, select: { id: true, name: true, phone: true, email: true } })
        : null;
    return { deal, contact };
}

// Переписка с контактом в этом канале. У Telegram и Viber внешний id — это id собеседника в мессенджере,
// а не телефон, поэтому связь ищем по контакту, а если её ещё нет — по совпадению имени (и запоминаем).
// возвращает запись беседы (Prisma): набор полей зависит от ветки, поэтому тип — any
async function conversationFor(org: string, channel: Channel, contact: ContactRef): Promise<any> {
    if (!contact) return null;
    const linked = await prisma.conversation.findFirst({ where: { owner: org, channel, contact: contact.id } });
    if (linked) return linked;
    if (channel === "sms") {
        const integration = await prisma.integration.findFirst({ where: { owner: org, type: { in: SMS_TYPES }, status: "connected" } });
        if (!integration || !contact.phone) return null;
        // канал беседы — тип самого провайдера (twilio, vonage, plivo, telnyx), а не «sms»
        const provider = String(integration.type);
        const wanted = digits(contact.phone);
        const all = await prisma.conversation.findMany({ where: { owner: org, channel: provider }, select: { id: true, externalId: true, contact: true, name: true } });
        const same = all.find((c) => digits(String(c.externalId)) === wanted);
        if (same) {
            // номер уже писал нам — привязываем беседу к контакту, чтобы в чате было видно имя
            if (!same.contact) await prisma.conversation.updateMany({ where: { id: same.id }, data: { contact: contact.id } });
            return same;
        }
        return prisma.conversation.create({
            data: {
                owner: org, integration: integration.id, channel: provider,
                externalId: contact.phone, name: contact.name || contact.phone, contact: contact.id,
            },
        });
    }
    // Viber, Telegram и WhatsApp: имя собеседника в переписке совпало с именем контакта — это он и есть
    const name = (contact.name ?? "").trim();
    if (!name) return null;
    const byName = await prisma.conversation.findFirst({ where: { owner: org, channel, name: { equals: name, mode: "insensitive" } } });
    if (!byName) return null;
    await prisma.conversation.updateMany({ where: { id: byName.id }, data: { contact: contact.id } });
    return byName;
}

async function availability(org: string, channel: Channel, contact: ContactRef, company?: unknown): Promise<Availability> {
    if (channel === "email") {
        const recipient = await resolveRecipient(org, undefined, { contact: contact?.id, company });
        if (!recipient) return "no_recipient";
        const account = await mailAccount(org);
        if (!account) return "no_mailbox";
        // при входе через Google/Microsoft согласие могло быть только на чтение — отправка не пройдёт
        return mailboxCanSend(account) ? "ready" : "no_send_scope";
    }
    if (!contact) return "no_contact";
    if (channel === "sms") {
        if (!contact.phone) return "no_phone";
        const provider = await prisma.integration.findFirst({ where: { owner: org, type: { in: SMS_TYPES }, status: "connected" }, select: { id: true } });
        if (!provider) return "no_provider";
    }
    return (await conversationFor(org, channel, contact)) ? "ready" : "no_conversation";
}

// Подключён ли канал у фирмы: по этому признаку вкладка вообще появляется в карточке
async function isConnected(org: string, channel: Channel): Promise<boolean> {
    const connected = async (where: Record<string, unknown>) => !!(await prisma.integration.findFirst({ where: where as any, select: { id: true } }));
    if (channel === "sms") return connected({ owner: org, type: { in: SMS_TYPES }, status: "connected" });
    if (channel === "viber") return connected({ owner: org, type: "viber", status: "connected" });
    if (channel === "telegram") return connected({ owner: org, type: "telegram", status: "connected" });
    if (channel === "whatsapp") return connected({ owner: org, type: "whatsapp", status: "connected" });
    return !!(await mailAccount(org));
}

// Последний документ сделки (предложение, счёт, заказ) — уходит вложением к письму
async function latestDocument(org: string, dealId: string, locale: string) {
    const [quote, invoice, order] = await Promise.all([
        prisma.quote.findFirst({ where: { org, deal: dealId }, orderBy: { createdAt: "desc" } }),
        prisma.invoice.findFirst({ where: { org, deal: dealId, kind: "invoice" }, orderBy: { createdAt: "desc" } }),
        prisma.order.findFirst({ where: { org, deal: dealId }, orderBy: { createdAt: "desc" } }),
    ]);
    const newest = [
        quote && { at: quote.createdAt, doc: quote, pdf: () => quotePdfBuffer(org, quote, locale) },
        invoice && { at: invoice.createdAt, doc: invoice, pdf: () => invoicePdfBuffer(org, invoice, locale) },
        order && { at: order.createdAt, doc: order, pdf: () => orderPdfBuffer(org, order, locale) },
    ].filter(Boolean).sort((a, b) => Number(b!.at) - Number(a!.at))[0];
    if (!newest) return null;
    const pdf = await newest.pdf();
    return { number: String(newest.doc.number ?? ""), file: { filename: `${newest.doc.number}.pdf`, contentType: "application/pdf", content: pdf } };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const found = await loadDeal(user.id, params.id, dealScope(user));
    if (!found) return notFound();
    const contact: ContactRef = found.contact ? { id: found.contact.id, name: found.contact.name, phone: found.contact.phone } : null;
    // Ящик, из которого уйдёт письмо: у фирмы их может быть несколько, и знать это нужно до отправки —
    // письмо уходит из первого подключённого (см. mailAccount)
    const mailbox = ((await mailAccount(user.id))?.config as any)?.email ?? "";
    const entries = await Promise.all(CHANNELS.map(async (channel) => [channel, {
        state: await availability(user.id, channel, contact, found.deal.company),
        connected: await isConnected(user.id, channel),
        // from — только у почты: подсказка «уйдёт с такого-то адреса» под полем
        ...(channel === "email" && mailbox ? { from: mailbox } : {}),
    }] as const));
    return NextResponse.json(Object.fromEntries(entries));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    const channel = String(body?.channel ?? "") as Channel;
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 2000) : "";
    if (!CHANNELS.includes(channel)) return badRequest("Unknown channel");
    if (!text) return badRequest("Text is required");
    const found = await loadDeal(user.id, params.id, dealScope(user));
    if (!found) return notFound();
    const { deal, contact } = found;
    const who: ContactRef = contact ? { id: contact.id, name: contact.name, phone: contact.phone } : null;

    const locale = ["en", "de", "ua"].includes(String(body?.locale)) ? String(body.locale) : "de";
    const state = await availability(user.id, channel, who, deal.company);
    if (state !== "ready") return NextResponse.json({ message: "Channel is not available", code: state }, { status: 409 });

    try {
        if (channel === "email") {
            const recipient = await resolveRecipient(user.id, undefined, { contact: contact?.id, company: deal.company });
            const account = await mailAccount(user.id);
            if (!recipient || !account) return NextResponse.json({ message: "Mailbox is not available", code: "no_mailbox" }, { status: 409 });
            // К письму прикладываем последний документ сделки: клиенту из карточки обычно отправляют
            // предложение или счёт, а не пустое письмо. Если документов нет — уходит просто текст.
            const attachment = await latestDocument(user.id, deal.id, locale);
            await sendFromAccount(account, {
                to: recipient.email,
                subject: [attachment?.number, String(deal.clientName || "")].filter(Boolean).join(" · "),
                text,
                ...(attachment ? { attachments: [attachment.file] } : {}),
            });
        } else {
            const conversation = await conversationFor(user.id, channel, who);
            if (!conversation) return NextResponse.json({ message: "Conversation is not available", code: "no_conversation" }, { status: 409 });
            const integration = await prisma.integration.findFirst({ where: { id: String(conversation.integration), owner: user.id } });
            if (!integration) return NextResponse.json({ message: "Channel is not connected", code: "no_provider" }, { status: 409 });
            await sendToConversation(integration, conversation, text);
        }
        // Отправленное остаётся в ленте сделки — рядом с заметками и звонками
        const activities = [...((deal.activities as any[]) ?? []), { type: channel === "email" ? "email" : channel, text }];
        const updated = await prisma.deal.update({ where: { id: deal.id }, data: { activities: activities as any } });
        return NextResponse.json(updated, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
