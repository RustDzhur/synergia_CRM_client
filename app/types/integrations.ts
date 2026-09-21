// Типы, общие для сервера (API) и клиента (Settings → Integration, Chat and Calls, Web Mails)

export type IntegrationType = "twilio" | "sip" | "telegram" | "viber" | "messenger" | "webchat" | "mail";
export type MessagingChannel = "twilio" | "sip" | "telegram" | "viber" | "messenger" | "webchat";

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

export interface MessageDTO {
    id: string;
    direction: "in" | "out";
    kind: "text" | "call";
    text: string;
    at: string;
    status: "sent" | "failed";
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
    at: string;
    starred: boolean;
    snoozed: boolean;
    read: boolean;
}
