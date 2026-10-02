import type { MailAccountDTO, MailDTO, MailProviderId } from "@/types/integrations";
import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import { createLeadsFromMail } from "@/lib/leads";
import { notify } from "@/lib/notify";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import { prisma } from "@/lib/prisma";
import { fetchGmail, gmailEmail, gmailMessageBody, sendGmail } from "./gmail";
import { ImapSmtpConfig, fetchImap, fetchImapMessage, sendSmtp, verifyImapSmtp } from "./imap";
import { Tokens, Vendor, refreshTokens } from "./oauth";
import { fetchOutlook, outlookEmail, outlookMessageBody, sendOutlook } from "./outlook";
import { MAIL_PRESETS, MAIL_PROVIDERS } from "./providers";
import type { Fetched, MailAttachment } from "./types";

type Doc = any;

export const toMailAccountDTO = (d: Doc): MailAccountDTO => {
    const c = (d.config ?? {}) as any;
    return {
        id: String(d.id),
        provider: c.provider,
        email: c.email,
        status: d.status,
        error: d.error,
        lastSyncAt: d.lastSyncAt ? new Date(d.lastSyncAt).toISOString() : "",
        autoLeads: c.autoLeads !== false,
        canSend: mailboxCanSend(d),
    };
};

// Может ли ящик отправлять. У входа по паролю — всегда да. У входа через Google/Microsoft согласие
// можно дать только на чтение (и это легко сделать случайно), тогда отправка отклоняется провайдером:
// лучше сказать об этом заранее и предложить подключить ящик заново.
export function mailboxCanSend(d: Doc): boolean {
    if ((d.config as any).authType !== "oauth") return true;
    const scope = String(secretsOf<{ scope?: string }>(d).scope ?? "");
    if (!scope) return true; // согласие выдано до этой проверки — не притворяемся, что знаем его состав
    if ((d.config as any).vendor === "google") return scope.includes("gmail.send") || scope.includes("https://mail.google.com/");
    return /mail\.send/i.test(scope);
}

export const toMailDTO = (m: Doc, withBody: boolean): MailDTO => ({
    id: String(m.id),
    accountId: String(m.account),
    folder: m.folder,
    from: m.from,
    to: m.to,
    subject: m.subject,
    body: withBody ? m.body : "",
    html: withBody ? m.html ?? "" : "",
    at: (m.at as Date).toISOString(),
    starred: m.starred,
    snoozed: m.snoozed,
    read: m.read,
});

// ── доступ к ящику ────────────────────────────────────────────────────────────

const imapConfig = (d: Doc): ImapSmtpConfig => ({ email: (d.config as any).email, ...((d.config as any).server ?? {}), password: secretsOf(d).password });
const isOAuth = (d: Doc) => (d.config as any).authType === "oauth";

// Токен OAuth живёт около часа: перед запросом при необходимости обновляем его по refresh-токену
async function accessToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) throw new ProviderError("Sign in to this mailbox again");
    const fresh = await refreshTokens((d.config as any).vendor as Vendor, s.refreshToken);
    await prisma.integration.update({ where: { id: d.id }, data: { secrets: packSecrets(fresh) } });
    return fresh.accessToken;
}

async function fetchAll(d: Doc, known: Set<string>): Promise<Fetched[]> {
    if (!isOAuth(d)) return fetchImap(imapConfig(d));
    const token = await accessToken(d);
    return (d.config as any).vendor === "google" ? fetchGmail(token, known) : fetchOutlook(token);
}

// Загружает новые письма в базу. Уже известные письма не перезаписываются: прочитано/звезда/«отложено» меняются в CRM.
// Из новых входящих писем создаются лиды (см. lib/leads.ts) — но только из тех, что пришли ПОСЛЕ подключения:
// первая синхронизация ящика лишь запоминает момент leadsSince, чтобы старая переписка не превратилась в сотни лидов.
export async function syncAccount(d: Doc) {
    const owner = String(d.owner);
    const cfg = (d.config ?? {}) as any;
    try {
        const known = new Set<string>((await prisma.mailMessage.findMany({ where: { account: d.id }, select: { externalId: true } })).map((m) => m.externalId));
        const fetched = await fetchAll(d, known);
        // уже известные письма НЕ перезаписываются: раньше это делал $setOnInsert, теперь — проверка по known
        const firstRun = !cfg.leadsSince;
        const inserted: Fetched[] = [];
        for (const m of fetched) {
            if (known.has(m.externalId)) continue;
            try {
                await prisma.mailMessage.create({
                    data: { owner, account: d.id, externalId: m.externalId, folder: m.folder, from: m.from, to: m.to, subject: m.subject, body: m.body, at: m.at, read: m.read, starred: m.starred },
                });
                inserted.push(m);
            } catch { /* дубликат из параллельной синхронизации — пропускаем */ }
        }
        let leads = 0;
        if (!firstRun && cfg.autoLeads !== false) {
            const since = new Date(cfg.leadsSince);
            const fresh = inserted.filter((m) => m.at >= since);
            leads = await createLeadsFromMail(owner, cfg.email, fresh);
            // уведомление о каждом новом входящем письме (не больше 5 за раз — дальше одно общее)
            const incoming = fresh.filter((m) => m.folder === "inbox");
            for (const m of incoming.slice(0, 5)) await notify(owner, { type: "mail", params: { from: m.from.replace(/<.*>/, "").trim() || m.from, subject: m.subject || "" }, link: "/crm/collaboration/web-mails", key: `mail:${d.id}:${m.externalId}` });
            if (incoming.length > 5) await notify(owner, { type: "mail_many", params: { count: incoming.length }, link: "/crm/collaboration/web-mails", key: `mail-many:${d.id}:${incoming[0].externalId}` });
            // То же в Telegram: о первых письмах подробно, об остальных — одной строкой, чтобы пачка
            // из сотни писем после долгой паузы не превратилась в сотню сообщений
            for (const m of incoming.slice(0, 3)) {
                void notifyTeamTelegram(owner, [`✉️ Новое письмо — ${cfg.email ?? ""}`, `От: ${String(m.from).replace(/<.*>/, "").trim() || m.from}`, `Тема: ${m.subject || "—"}`].join("\n"));
            }
            if (incoming.length > 3) void notifyTeamTelegram(owner, `✉️ Ещё ${incoming.length - 3} новых письма на ${cfg.email ?? "почту"}`);
        }
        await prisma.integration.update({
            where: { id: d.id },
            data: {
                ...(firstRun ? { config: { ...cfg, leadsSince: new Date().toISOString() } as any } : {}),
                status: "connected",
                error: "",
                lastSyncAt: new Date(),
            },
        });
        return { added: fetched.length, leads };
    } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError("Could not load the mailbox");
        await prisma.integration.update({ where: { id: d.id }, data: { status: "error", error: err.message } });
        throw err;
    }
}

// Отправка письма. Копию в «Отправленных» сохраняем сразу (для Outlook её подтянет синхронизация).
export async function sendFromAccount(d: Doc, msg: { to: string; subject: string; text: string; attachments?: MailAttachment[] }) {
    const owner = String(d.owner);
    const email: string = (d.config as any).email;
    let externalId: string | null;
    if (!isOAuth(d)) {
        externalId = await sendSmtp(imapConfig(d), msg);
    } else if ((d.config as any).vendor === "google") {
        externalId = await sendGmail(await accessToken(d), { from: email, ...msg });
    } else {
        await sendOutlook(await accessToken(d), msg);
        externalId = null;
        await syncAccount(d).catch(() => undefined);
    }
    if (!externalId) return null;
    return prisma.mailMessage.create({ data: { owner, account: d.id, externalId, folder: "sent", from: email, to: msg.to, subject: msg.subject, body: msg.text, at: new Date(), read: true } });
}

// Тело письма у провайдера: нужно для писем, загруженных до того, как мы начали хранить HTML,
// и для писем, у которых текст пришёл обрезанным. Результат кладём в запись — второй раз не тянем.
export async function fetchMailBody(d: Doc, externalId: string): Promise<{ html: string; text: string }> {
    if (!isOAuth(d)) return fetchImapMessage(imapConfig(d), externalId);
    const token = await accessToken(d);
    return (d.config as any).vendor === "google" ? gmailMessageBody(token, externalId) : outlookMessageBody(token, externalId);
}

// ── подключение ───────────────────────────────────────────────────────────────

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const port = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
};

async function upsertAccount(owner: string, email: string, config: Record<string, unknown>, secrets: unknown) {
    // ящик ищем по config.email: в схеме Prisma поля email внутри Json, поэтому сверяем в JS
    const list = await prisma.integration.findMany({ where: { owner, type: "mail" } });
    const existing = list.find((d) => String((d.config as any)?.email ?? "") === email) ?? null;
    // при повторном входе в тот же ящик сохраняем настройки лидов, чтобы старая переписка не стала лидами заново
    const prev = (existing?.config ?? {}) as any;
    const keep = { leadsSince: prev.leadsSince, autoLeads: prev.autoLeads };
    const data = {
        name: email,
        config: { ...config, email, ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)) } as any,
        secrets: packSecrets(secrets),
        status: "connected",
        error: "",
    };
    return existing
        ? prisma.integration.update({ where: { id: existing.id }, data })
        : prisma.integration.create({ data: { owner, type: "mail", token: randomToken(), ...data } });
}

// Вход по паролю (пароль приложения): проверяем IMAP и SMTP, затем сохраняем
export async function connectPasswordAccount(owner: string, input: Record<string, unknown>) {
    const provider = str(input.provider, 20) as MailProviderId;
    if (!MAIL_PROVIDERS.includes(provider)) throw new ProviderError("Unknown mail provider");
    const email = str(input.email).toLowerCase();
    // пароли приложений не содержат пробелов, а Google показывает их группами «abcd efgh ijkl mnop» — пробелы убираем
    const password = provider === "imap" ? str(input.password) : str(input.password).replace(/\s+/g, "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ProviderError("Enter a valid email address");
    if (!password) throw new ProviderError("Password is required");

    const preset = provider === "imap" ? null : MAIL_PRESETS[provider];
    const server = {
        imapHost: preset?.imapHost ?? str(input.imapHost, 253),
        imapPort: preset?.imapPort ?? port(input.imapPort, 993),
        smtpHost: preset?.smtpHost ?? str(input.smtpHost, 253),
        smtpPort: preset?.smtpPort ?? port(input.smtpPort, 465),
    };
    if (!server.imapHost || !server.smtpHost) throw new ProviderError("IMAP and SMTP server addresses are required");

    await verifyImapSmtp({ email, password, ...server });
    return upsertAccount(owner, email, { provider, authType: "password", server }, { password });
}

// Вход через Google / Microsoft: после обмена кода на токены узнаём адрес ящика и сохраняем
export async function connectOAuthAccount(owner: string, vendor: Vendor, tokens: Tokens) {
    if (!tokens.refreshToken) throw new ProviderError("The provider did not allow offline access");
    const email = ((vendor === "google" ? await gmailEmail(tokens.accessToken) : await outlookEmail(tokens.accessToken)) || "").toLowerCase();
    if (!email) throw new ProviderError("Could not read the mailbox address");
    return upsertAccount(owner, email, { provider: vendor === "google" ? "gmail" : "outlook", authType: "oauth", vendor }, tokens);
}

export async function removeAccount(d: Doc) {
    await prisma.mailMessage.deleteMany({ where: { account: d.id } });
    await prisma.integration.deleteMany({ where: { id: d.id } });
}
