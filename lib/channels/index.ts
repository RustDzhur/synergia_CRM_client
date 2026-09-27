import type { HydratedDocument } from "mongoose";
import type { ConversationDTO, MessageDTO, MessagingChannel } from "@/app/types/integrations";
import { ProviderError } from "@/lib/http";
import { emit } from "@/lib/automation/emit";
import { notify } from "@/lib/notify";
import { secretsOf } from "@/lib/integrations";
import Contact from "@/models/Contact";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import { sendMessenger } from "./messenger";
import { sendSms, TwilioSecrets } from "./twilio";
import { fetchMedia, mediaLabel, mediaUrl, telegramMedia, type MediaRef, type OutgoingMedia, type StoredMedia } from "./media";
import { sendTelegram, sendTelegramMedia } from "./telegram";
import { sendViber, sendViberMedia } from "./viber";
import { sendWhatsApp } from "./whatsapp";

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
    attachment: m.attachment?.path
        ? { kind: m.attachment.kind, name: m.attachment.name, mime: m.attachment.mime, size: m.attachment.size ?? 0 }
        : null,
});

const digits = (s?: string) => (s ?? "").replace(/\D/g, "");

// Номера считаем одинаковыми, если совпали цифры целиком или последние 9 (так «0177 5519322» и «+49 177 5519322» — один номер)
export const samePhone = (a?: string, b?: string) => {
    const x = digits(a);
    const y = digits(b);
    if (!x || !y) return false;
    return x === y || (x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9));
};

// Если номер собеседника совпал с телефоном контакта из CRM — беседа подписывается именем контакта
// (номера приходят в Twilio, SIP и WhatsApp)
async function matchContact(owner: string, channel: string, externalId: string) {
    if (channel !== "twilio" && channel !== "sip" && channel !== "whatsapp") return null;
    const contacts = await Contact.find({ owner, phone: { $exists: true, $ne: "" } }).select("name phone").lean();
    return contacts.find((c: { phone?: string }) => samePhone(c.phone, externalId)) ?? null;
}

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

// Текст записи о звонке в ленте активности контакта
export function callActivityText(direction: "in" | "out", status: string, duration: number) {
    const dir = direction === "in" ? "Incoming call" : "Outgoing call";
    if (status === "completed") return `${dir}, ${mmss(duration)}`;
    if (direction === "in") return "Missed call";
    return status === "busy" ? `${dir}, busy` : status === "failed" ? `${dir}, failed` : `${dir}, no answer`;
}

interface MessageInput {
    externalId: string; // собеседник
    name?: string;
    text: string;
    direction?: "in" | "out";
    kind?: "text" | "call";
    meta?: Record<string, string | number>;
    messageId?: string; // id у провайдера
    media?: MediaRef; // входящее вложение: забираем у провайдера и кладём в хранилище фирмы
    attachment?: StoredMedia; // исходящее вложение: файл уже в хранилище (его отправил оператор)
}

// Единая точка записи: входящее из вебхука, исходящее из CRM и запись о звонке проходят через неё.
// Повторная доставка того же вебхука (тот же messageId) игнорируется.
export async function recordMessage(integration: Doc, input: MessageInput) {
    const direction = input.direction ?? "in";
    const owner = integration.owner.toString();
    const channel = integration.type as MessagingChannel;
    // повторная доставка того же вебхука: выходим до скачивания, чтобы не тянуть вложение второй раз
    if (direction === "in" && input.messageId) {
        const seen = await Message.findOne({ integration: integration._id, externalId: input.messageId }).select("conversation").lean<{ conversation: unknown }>();
        if (seen) return { conversation: await Conversation.findById(seen.conversation), message: null, duplicate: true };
    }
    // входящий файл забираем до записи: он нужен и самому сообщению, и подписи в списке бесед
    const attachment = input.attachment ?? (input.media ? await fetchMedia(owner, integration, input.media) : null);

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
    // звонок от номера, который добавили в контакты уже после первой беседы, тоже привязываем к контакту
    if (input.kind === "call" && !conversation.contact) {
        const contact = await matchContact(owner, channel, input.externalId);
        if (contact) {
            conversation.contact = contact._id;
            conversation.name = contact.name || conversation.name;
        }
    }

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
            attachment,
        });
    } catch (e) {
        if ((e as { code?: number }).code === 11000) return { conversation, message: null, duplicate: true };
        throw e;
    }

    // подпись сообщения без текста: «📷» / «🎤» / имя файла — понятно на любом языке
    const preview = input.kind === "call" ? `📞 ${input.text}` : input.text || mediaLabel(attachment);
    conversation.lastText = preview.slice(0, 120);
    conversation.lastAt = message.createdAt;
    // принятый входящий звонок «непрочитанным» не считается
    if (direction === "in" && !(input.kind === "call" && input.meta?.status === "completed")) conversation.unread += 1;
    // имя из Telegram/Viber могло смениться, а вот вручную выбранное имя контакта не трогаем
    if (direction === "in" && input.name && !conversation.contact) conversation.name = input.name;
    await conversation.save();
    // уведомления: пропущенный звонок и новое входящее сообщение (повторная доставка вебхука уже отсеяна выше по messageId)
    if (direction === "in") {
        if (input.kind === "call") {
            if (input.meta?.status !== "completed") await emit(owner, { type: "call_missed", data: { from: conversation.name || input.externalId, name: conversation.name || input.externalId } });
            if (input.meta?.status !== "completed") await notify(owner, { type: "missed_call", params: { name: conversation.name || input.externalId }, link: "/crm/collaboration/chat-and-calls", key: input.messageId ? `call:${input.messageId}` : undefined });
        } else {
            await emit(owner, { type: "message_received", data: { from: conversation.name || input.externalId, text: preview, channel } });
            await notify(owner, { type: "message", params: { name: conversation.name || input.externalId, channel, text: preview.slice(0, 80) }, link: "/crm/collaboration/chat-and-calls", key: `msg:${message._id}` });
        }
    }
    // каждый звонок фиксируется и в ленте активности контакта (карточка контакта → «Activity»)
    if (input.kind === "call" && conversation.contact) {
        await Contact.updateOne(
            { _id: conversation.contact, owner },
            { $push: { activities: { type: "call", text: callActivityText(direction, String(input.meta?.status ?? ""), Number(input.meta?.duration) || 0), meta: "" } } }
        );
    }
    return { conversation, message, duplicate: false };
}

// Отчёт о доставке от WhatsApp: его присылают отдельным вебхуком уже после отправки, поэтому отмечаем сообщение задним числом
export async function markMessageFailed(integration: Doc, externalId: string, error: string) {
    if (!externalId) return false;
    const res = await Message.updateOne(
        { integration: integration._id, externalId, direction: "out" },
        { $set: { status: "failed", meta: { error } } }
    );
    return res.modifiedCount > 0;
}

// Каналы, через которые можно отправлять фото, файлы и голосовые (у остальных таких методов нет)
export const MEDIA_CHANNELS: MessagingChannel[] = ["telegram", "viber"];

// Отправка ответа оператора: провайдер отправляет, и только потом сообщение попадает в беседу
export async function sendToConversation(integration: Doc, conversation: Doc, text: string, media?: OutgoingMedia) {
    const channel = integration.type as MessagingChannel;
    if (media && !MEDIA_CHANNELS.includes(channel)) throw new ProviderError("This channel does not accept file attachments yet");
    let externalId: string | undefined;
    switch (channel) {
        case "telegram": {
            // в Telegram голосовое уходит в Ogg/Opus, даже если запись сделана в WebM (см. telegramMedia)
            const out = media ? telegramMedia(media) : null;
            externalId = out
                ? `${conversation.externalId}:${await sendTelegramMedia(secretsOf(integration).botToken, conversation.externalId, out.attachment, out.data, text)}`
                : `${conversation.externalId}:${await sendTelegram(secretsOf(integration).botToken, conversation.externalId, text)}`;
            break;
        }
        case "viber": {
            const token = secretsOf(integration).authToken;
            const botName = integration.config.botName ?? "";
            externalId = media
                ? await sendViberMedia(token, botName, conversation.externalId, media.attachment, mediaUrl(media.origin, media.attachment.path), text)
                : await sendViber(token, botName, conversation.externalId, text);
            break;
        }
        case "messenger":
            externalId = await sendMessenger(secretsOf(integration).pageAccessToken, conversation.externalId, text);
            break;
        case "whatsapp":
            externalId = await sendWhatsApp(secretsOf(integration).accessToken, integration.config.phoneNumberId, conversation.externalId, text);
            break;
        case "twilio":
            externalId = await sendSms(secretsOf<TwilioSecrets>(integration), integration.config.phone, conversation.externalId, text);
            break;
        case "sip":
            throw new ProviderError("SIP provider has calls only — text messages are not supported");
        case "webchat":
            break; // посетитель сам заберёт сообщение при следующем опросе
        default:
            throw new ProviderError("Unsupported channel");
    }
    return recordMessage(integration, {
        externalId: conversation.externalId,
        text,
        direction: "out",
        messageId: externalId || undefined,
        attachment: media?.attachment,
    });
}
