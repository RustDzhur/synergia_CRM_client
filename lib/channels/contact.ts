import type { MessagingChannel } from "@/types/integrations";
import { prisma } from "@/lib/prisma";
import { secretsOf } from "@/lib/integrations";
import { instagramUserProfile } from "./instagram";
import { messengerUserProfile } from "./messenger";

type Doc = any;

// Каналы, где собеседник опознаётся не по телефону, а по своему id у провайдера.
// Для них входящее сообщение обязано иметь карточку контакта в CRM: по ней видно имя, канал и аватар,
// а оператор может открыть обычную карточку клиента и работать с ней как с любым другим контактом.
export const CHANNEL_CONTACT_CHANNELS: MessagingChannel[] = ["instagram", "messenger", "telegram", "viber", "webchat"];

export const isChannelContactChannel = (channel: string): channel is MessagingChannel =>
    (CHANNEL_CONTACT_CHANNELS as string[]).includes(channel);

const CHANNEL_LABEL: Record<string, string> = {
    instagram: "Instagram",
    messenger: "Messenger",
    telegram: "Telegram",
    viber: "Viber",
    webchat: "Web chat",
};

// Имена-заглушки, которые провайдер отдаёт вместо имени человека. Такое имя можно заменить, когда
// провайдер всё-таки пришлёт настоящее, — а имя, введённое оператором, не трогаем.
const GENERIC_NAMES = new Set(["Viber", "Telegram", "Messenger", "Instagram", "Web chat", "Visitor", "Bot", "Client"]);

export function channelContactFallbackName(channel: string, externalId: string) {
    const label = CHANNEL_LABEL[channel] ?? channel;
    const tail = externalId.replace(/[^a-zA-Z0-9]/g, "").slice(-4);
    return tail ? `${label} ${tail}` : label;
}

export function channelContactName(channel: string, externalId: string, name?: string) {
    const clean = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!clean || GENERIC_NAMES.has(clean)) return channelContactFallbackName(channel, externalId);
    return clean;
}

function splitName(name: string) {
    const parts = name.split(/\s+/).filter(Boolean);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

// Аватар из профиля нужен только при заведении карточки. Для Telegram и чата на сайте провайдер
// картинку не отдаёт, у Viber она приходит в самом событии (input.avatar), у Meta — отдельным запросом,
// который делается один раз на нового собеседника, а не на каждое сообщение.
async function profileAvatar(integration: Doc, channel: MessagingChannel, externalId: string) {
    if (channel !== "messenger" && channel !== "instagram") return "";
    try {
        const token = String(secretsOf<{ pageAccessToken?: string }>(integration).pageAccessToken ?? "");
        if (!token) return "";
        const profile = channel === "messenger"
            ? await messengerUserProfile(token, externalId)
            : await instagramUserProfile(token, externalId);
        return profile.avatar || "";
    } catch {
        return "";
    }
}

export interface ChannelContactOptions {
    name?: string;
    avatar?: string;
    // Ленивое восстановление карточки у старой беседы (GET переписки) не должно ждать Graph API:
    // аватар там необязателен, а имя для карточки уже есть в беседе.
    fetchProfile?: boolean;
}

/**
 * Найти или создать контакт собеседника внешнего канала по ключу (owner, channel, externalId).
 * Вызывается при записи входящего сообщения. Возвращает карточку контакта или null, если канал
 * не входит в список (телефонные каналы по-прежнему сопоставляются по номеру).
 */
export async function ensureChannelContact(integration: Doc, externalId: string, options: ChannelContactOptions = {}) {
    const channel = String(integration.type ?? "") as MessagingChannel;
    if (!isChannelContactChannel(channel) || !externalId) return null;
    const owner = String(integration.owner);
    const where = { owner, channel, externalId };

    const existing = await prisma.contact.findFirst({
        where,
        select: { id: true, name: true, avatar: true },
    });
    if (existing) {
        const data: { name?: string; firstName?: string; lastName?: string; avatar?: string } = {};
        // Имя-заглушку («Instagram 1234») заменяем, когда провайдер прислал настоящее. Имя,
        // которое уже стоит у контакта и не похоже на заглушку, оставляем: его мог поправить оператор.
        const placeholder = !existing.name || GENERIC_NAMES.has(existing.name) || existing.name === externalId || existing.name === channelContactFallbackName(channel, externalId);
        if (placeholder) {
            const next = channelContactName(channel, externalId, options.name);
            if (next && next !== existing.name) Object.assign(data, { name: next, ...splitName(next) });
        }
        if (!existing.avatar && options.avatar) data.avatar = options.avatar;
        if (Object.keys(data).length) await prisma.contact.update({ where: { id: existing.id }, data }).catch(() => undefined);
        return { id: existing.id, name: data.name ?? existing.name, avatar: data.avatar ?? existing.avatar };
    }

    const name = channelContactName(channel, externalId, options.name);
    const avatar = options.avatar || (options.fetchProfile === false ? "" : await profileAvatar(integration, channel, externalId));
    const data = {
        owner,
        name,
        ...splitName(name),
        channel,
        externalId,
        avatar,
        source: `${channel}:${externalId}`,
        firstContactAt: new Date(),
    };
    try {
        return await prisma.contact.create({ data, select: { id: true, name: true, avatar: true } });
    } catch (e) {
        // Параллельная доставка того же события: карточку уже создал соседний запрос — берём её.
        if ((e as { code?: string }).code === "P2002") {
            return prisma.contact.findFirst({ where, select: { id: true, name: true, avatar: true } });
        }
        throw e;
    }
}
