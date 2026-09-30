// Типы, общие для сервера (API) и клиента (Settings → Integration, Chat and Calls, Web Mails)

export type IntegrationType = "twilio" | "sip" | "vonage" | "plivo" | "telnyx" | "telegram" | "viber" | "whatsapp" | "messenger" | "webchat" | "mail" | "novaposhta";
export type MessagingChannel = "twilio" | "sip" | "vonage" | "plivo" | "telnyx" | "telegram" | "viber" | "whatsapp" | "messenger" | "webchat";

export interface IntegrationDTO {
    id: string;
    type: IntegrationType;
    name: string;
    status: "connected" | "error";
    error: string;
    // несекретные настройки: номер телефона, имя бота, хост почты, оформление виджета…
    config: Record<string, string>;
    // адреса, которые нужно указать у провайдера вручную (если он не настраивается автоматически)
    webhookUrl: string;
    // у WhatsApp адрес вебхука один на платформу: маркер подтверждения тоже общий (см. lib/platformSettings)
    platformVerifyToken?: string;
    createdAt: string;
}

export interface ConversationDTO {
    id: string;
    channel: MessagingChannel;
    integrationId: string;
    externalId: string;
    name: string;
    unread: number;
    lastText: string;
    lastAt: string;
    contactId: string;
}

// Запись журнала звонков (все провайдеры): для списка «Недавние» в звонилке
export interface CallDTO {
    id: string;
    direction: "in" | "out";
    peer: string;
    name: string;
    // completed | missed | no-answer | busy | failed
    status: string;
    duration: number;
    at: string;
    integrationId: string;
    channel: MessagingChannel;
}

// Вложение сообщения: файл лежит в хранилище фирмы, в переписке отдаётся по /api/messages/:id/attachment
export interface AttachmentDTO {
    kind: "image" | "file" | "voice";
    name: string;
    mime: string;
    size: number;
}

export interface MessageDTO {
    id: string;
    direction: "in" | "out";
    kind: "text" | "call";
    text: string;
    at: string;
    status: "sent" | "failed";
    attachment: AttachmentDTO | null;
    // для звонков: { status: "completed" | "no-answer" | "busy" | "failed", duration: секунды }
    meta: Record<string, string | number>;
}

export interface MailAccountDTO {
    id: string;
    provider: MailProviderId;
    email: string;
    status: "connected" | "error";
    error: string;
    lastSyncAt: string;
    autoLeads: boolean; // создавать контакты и лиды из новых входящих писем
    // при входе через Google/Microsoft согласие можно дать только на чтение: тогда ящик принимает письма,
    // но отправить не может, и об этом нужно сказать — иначе отправка молча не работает
    canSend: boolean;
}

export type MailProviderId = "gmail" | "outlook" | "yahoo" | "icloud" | "office365" | "imap";

export interface MailDTO {
    id: string;
    accountId: string;
    folder: "inbox" | "sent" | "draft";
    from: string;
    to: string;
    subject: string;
    body: string;
    // HTML оригинала (если письмо пришло размеченным): показывается в окне письма в песочнице
    html?: string;
    at: string;
    starred: boolean;
    snoozed: boolean;
    read: boolean;
}
