import type { HydratedDocument } from "mongoose";
import type { ConversationDTO, MessageDTO, MessagingChannel } from "@/app/types/integrations";
import { ProviderError } from "@/lib/http";
import { secretsOf } from "@/lib/integrations";
import Contact from "@/models/Contact";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { sendMessenger } from "./messenger";
import { sendSms, TwilioSecrets } from "./twilio";
import { sendTelegram } from "./telegram";
import { sendViber } from "./viber";

type Doc = HydratedDocument<any>;

export const toConversationDTO = (c: Doc): ConversationDTO => ({
    id: c._id.toString(),
    channel: c.channel,
    integrationId: c.integration.toString(),
    externalId: c.externalId,
    name: c.name,
    unread: c.unread,
    lastText: c.lastText,
    lastAt: (c.lastAt as Date).toISOString(),
    contactId: c.contact?.toString() ?? "",
});

export const toMessageDTO = (m: Doc): MessageDTO => ({
    id: m._id.toString(),
    direction: m.direction,
    kind: m.kind,
    text: m.text,
    at: m.createdAt.toISOString(),
    status: m.status,
    meta: m.meta ?? {},
});

const digits = (s?: string) => (s ?? "").replace(/\D/g, "");

// Если номер собеседника совпал с телефоном контакта из CRM — беседа подписывается именем контакта
async function matchContact(owner: string, channel: string, externalId: string) {
    if (channel !== "twilio") return null;
    const d = digits(externalId);
    const contacts = await Contact.find({ owner, phone: { $exists: true, $ne: "" } }).select("name phone").lean();
    return contacts.find((c: { phone?: string }) => digits(c.phone) === d) ?? null;
}

interface MessageInput {
    externalId: string; // собеседник
    name?: string;
    text: string;
    direction?: "in" | "out";
    kind?: "text" | "call";
    meta?: Record<string, string | number>;
    messageId?: string; // id у провайдера
}

// Единая точка записи: входящее из вебхука, исходящее из CRM и запись о звонке проходят через неё.
// Повторная доставка того же вебхука (тот же messageId) игнорируется.
export async function recordMessage(integration: Doc, input: MessageInput) {
    const direction = input.direction ?? "in";
    const owner = integration.owner.toString();
    const channel = integration.type as MessagingChannel;

    let conversation = await Conversation.findOne({ integration: integration._id, externalId: input.externalId });
    if (!conversation) {
        const contact = await matchContact(owner, channel, input.externalId);
        try {
            conversation = await Conversation.create({
                owner,
                integration: integration._id,
                channel,
                externalId: input.externalId,
                name: contact?.name || input.name || input.externalId,
                contact: contact?._id,
            });
        } catch {
            conversation = await Conversation.findOne({ integration: integration._id, externalId: input.externalId });
        }
    }
    if (!conversation) throw new Error("Conversation was not created");

    let message;
    try {
        message = await Message.create({
            owner,
            conversation: conversation._id,
            integration: integration._id,
            direction,
            kind: input.kind ?? "text",
            text: input.text,
            meta: input.meta ?? {},
            externalId: input.messageId,
        });
    } catch (e) {
        if ((e as { code?: number }).code === 11000) return { conversation, message: null, duplicate: true };
        throw e;
    }

    const preview = input.kind === "call" ? `📞 ${input.text}` : input.text;
    conversation.lastText = preview.slice(0, 120);
    conversation.lastAt = message.createdAt;
    // принятый входящий звонок «непрочитанным» не считается
    if (direction === "in" && !(input.kind === "call" && input.meta?.status === "completed")) conversation.unread += 1;
    // имя из Telegram/Viber могло смениться, а вот вручную выбранное имя контакта не трогаем
    if (direction === "in" && input.name && !conversation.contact) conversation.name = input.name;
    await conversation.save();
    return { conversation, message, duplicate: false };
}

// Отправка ответа оператора: провайдер отправляет, и только потом сообщение попадает в беседу
export async function sendToConversation(integration: Doc, conversation: Doc, text: string) {
    let externalId: string | undefined;
    switch (integration.type as MessagingChannel) {
        case "telegram":
            externalId = `${conversation.externalId}:${await sendTelegram(secretsOf(integration).botToken, conversation.externalId, text)}`;
            break;
        case "viber":
            externalId = await sendViber(secretsOf(integration).authToken, integration.config.botName ?? "", conversation.externalId, text);
            break;
        case "messenger":
            externalId = await sendMessenger(secretsOf(integration).pageAccessToken, conversation.externalId, text);
            break;
        case "twilio":
            externalId = await sendSms(secretsOf<TwilioSecrets>(integration), integration.config.phone, conversation.externalId, text);
            break;
        case "webchat":
            break; // посетитель сам заберёт сообщение при следующем опросе
        default:
            throw new ProviderError("Unsupported channel");
    }
    return recordMessage(integration, { externalId: conversation.externalId, text, direction: "out", messageId: externalId || undefined });
}
