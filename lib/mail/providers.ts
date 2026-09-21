import type { MailProviderId } from "@/app/types/integrations";

export interface MailPreset { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }

// Серверы популярных почтовых сервисов; для «IMAP» пользователь вводит свои
export const MAIL_PRESETS: Record<Exclude<MailProviderId, "imap">, MailPreset> = {
    gmail: { imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 465 },
    outlook: { imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp-mail.outlook.com", smtpPort: 587 },
    office365: { imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com", smtpPort: 587 },
    yahoo: { imapHost: "imap.mail.yahoo.com", imapPort: 993, smtpHost: "smtp.mail.yahoo.com", smtpPort: 465 },
    icloud: { imapHost: "imap.mail.me.com", imapPort: 993, smtpHost: "smtp.mail.me.com", smtpPort: 587 },
};

export const MAIL_PROVIDERS: MailProviderId[] = ["gmail", "outlook", "yahoo", "icloud", "office365", "imap"];
