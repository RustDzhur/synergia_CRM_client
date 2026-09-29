import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { mailboxCanSend, sendFromAccount } from "@/lib/mail";
import { sendToConversation } from "@/lib/channels";
import { mailAccount, resolveRecipient } from "@/lib/finance/send";
import { invoicePdfBuffer, orderPdfBuffer, quotePdfBuffer } from "@/lib/finance/document";
import Contact from "@/models/Contact";
import Invoice from "@/models/Invoice";
import Order from "@/models/Order";
import Quote from "@/models/Quote";
import Conversation from "@/models/Conversation";
import Deal from "@/models/Deal";
import Integration from "@/models/Integration";

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

const CHANNELS: Channel[] = ["sms", "viber", "telegram", "whatsapp", "email"];
const SMS_TYPES = ["twilio", "vonage", "plivo", "telnyx"];
// Провайдеры, которые шлют SMS: у Twilio это ещё и звонки, поэтому отдельного типа «sms» нет
const digits = (v: string) => v.replace(/\D/g, "");

async function loadDeal(org: string, id: string) {
    const deal = await Deal.findOne({ _id: id, owner: org });
    if (!deal) return null;
    const contact = deal.contact ? await Contact.findOne({ _id: deal.contact, owner: org }).select("name phone email") : null;
    return { deal, contact };
}

// Переписка с контактом в этом канале. У Telegram и Viber внешний id — это id собеседника в мессенджере,
// а не телефон, поэтому связь ищем по контакту, а если её ещё нет — по совпадению имени (и запоминаем).
async function conversationFor(org: string, channel: Channel, contact: { _id: unknown; name?: string; phone?: string } | null) {
    if (!contact) return null;
    const linked = await Conversation.findOne({ owner: org, channel, contact: contact._id });
    if (linked) return linked;
    if (channel === "sms") {
        const integration = await Integration.findOne({ owner: org, type: { $in: SMS_TYPES }, status: "connected" });
        if (!integration || !contact.phone) return null;
        // канал беседы — тип самого провайдера (twilio, vonage, plivo, telnyx), а не «sms»
        const provider = String(integration.type);
        const wanted = digits(contact.phone);
        const all = await Conversation.find({ owner: org, channel: provider }).select("externalId contact name");
        const same = all.find((c) => digits(String(c.externalId)) === wanted);
        if (same) {
            // номер уже писал нам — привязываем беседу к контакту, чтобы в чате было видно имя
            if (!same.contact) await Conversation.updateOne({ _id: same._id }, { $set: { contact: contact._id } });
            return same;
        }
        return Conversation.create({
            owner: org, integration: integration._id, channel: provider,
            externalId: contact.phone, name: contact.name || contact.phone, contact: contact._id,
        });
    }
    // Viber, Telegram и WhatsApp: имя собеседника в переписке совпало с именем контакта — это он и есть
    const name = (contact.name ?? "").trim();
    if (!name) return null;
    const byName = await Conversation.findOne({ owner: org, channel, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (!byName) return null;
    await Conversation.updateOne({ _id: byName._id }, { $set: { contact: contact._id } });
    return byName;
}

async function availability(org: string, channel: Channel, contact: { _id: unknown; name?: string; phone?: string } | null, company?: unknown): Promise<Availability> {
    if (channel === "email") {
        const recipient = await resolveRecipient(org, undefined, { contact: contact?._id, company });
        if (!recipient) return "no_recipient";
        const account = await mailAccount(org);
        if (!account) return "no_mailbox";
        // при входе через Google/Microsoft согласие могло быть только на чтение — отправка не пройдёт
        return mailboxCanSend(account) ? "ready" : "no_send_scope";
    }
    if (!contact) return "no_contact";
    if (channel === "sms") {
        if (!contact.phone) return "no_phone";
        const provider = await Integration.exists({ owner: org, type: { $in: SMS_TYPES }, status: "connected" });
        if (!provider) return "no_provider";
    }
    return (await conversationFor(org, channel, contact)) ? "ready" : "no_conversation";
}

// Подключён ли канал у фирмы: по этому признаку вкладка вообще появляется в карточке
async function isConnected(org: string, channel: Channel): Promise<boolean> {
    if (channel === "sms") return !!(await Integration.exists({ owner: org, type: { $in: SMS_TYPES }, status: "connected" }));
    if (channel === "viber") return !!(await Integration.exists({ owner: org, type: "viber", status: "connected" }));
    if (channel === "telegram") return !!(await Integration.exists({ owner: org, type: "telegram", status: "connected" }));
    if (channel === "whatsapp") return !!(await Integration.exists({ owner: org, type: "whatsapp", status: "connected" }));
    return !!(await mailAccount(org));
}

// Последний документ сделки (предложение, счёт, заказ) — уходит вложением к письму
async function latestDocument(org: string, dealId: string, locale: string) {
    const [quote, invoice, order] = await Promise.all([
        Quote.findOne({ org, deal: dealId }).sort({ createdAt: -1 }),
        Invoice.findOne({ org, deal: dealId, kind: "invoice" }).sort({ createdAt: -1 }),
        Order.findOne({ org, deal: dealId }).sort({ createdAt: -1 }),
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
    await connectDB();
    const found = await loadDeal(user.id, params.id);
    if (!found) return notFound();
    const contact = found.contact ? { _id: found.contact._id, name: found.contact.name, phone: found.contact.phone } : null;
    // Ящик, из которого уйдёт письмо: у фирмы их может быть несколько, и знать это нужно до отправки —
    // письмо уходит из первого подключённого (см. mailAccount)
    const mailbox = (await mailAccount(user.id))?.config?.email ?? "";
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
    await connectDB();
    const found = await loadDeal(user.id, params.id);
    if (!found) return notFound();
    const { deal, contact } = found;
    const who = contact ? { _id: contact._id, name: contact.name, phone: contact.phone } : null;

    const locale = ["en", "de", "ua"].includes(String(body?.locale)) ? String(body.locale) : "de";
    const state = await availability(user.id, channel, who, deal.company);
    if (state !== "ready") return NextResponse.json({ message: "Channel is not available", code: state }, { status: 409 });

    try {
        if (channel === "email") {
            const recipient = await resolveRecipient(user.id, undefined, { contact: contact?._id, company: deal.company });
            const account = await mailAccount(user.id);
            if (!recipient || !account) return NextResponse.json({ message: "Mailbox is not available", code: "no_mailbox" }, { status: 409 });
            // К письму прикладываем последний документ сделки: клиенту из карточки обычно отправляют
            // предложение или счёт, а не пустое письмо. Если документов нет — уходит просто текст.
            const attachment = await latestDocument(user.id, String(deal._id), locale);
            await sendFromAccount(account, {
                to: recipient.email,
                subject: [attachment?.number, String(deal.clientName || "")].filter(Boolean).join(" · "),
                text,
                ...(attachment ? { attachments: [attachment.file] } : {}),
            });
        } else {
            const conversation = await conversationFor(user.id, channel, who);
            if (!conversation) return NextResponse.json({ message: "Conversation is not available", code: "no_conversation" }, { status: 409 });
            const integration = await Integration.findOne({ _id: conversation.integration, owner: user.id });
            if (!integration) return NextResponse.json({ message: "Channel is not connected", code: "no_provider" }, { status: 409 });
            await sendToConversation(integration, conversation, text);
        }
        // Отправленное остаётся в ленте сделки — рядом с заметками и звонками
        const updated = await Deal.findOneAndUpdate(
            { _id: deal._id },
            { $push: { activities: { type: channel === "email" ? "email" : channel, text } } },
            { new: true },
        );
        return NextResponse.json(updated, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
