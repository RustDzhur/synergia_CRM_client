import type { HydratedDocument } from "mongoose";
import type { MailAccountDTO, MailDTO, MailProviderId } from "@/app/types/integrations";
import { ProviderError } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import Integration from "@/models/Integration";
import MailMessage from "@/models/MailMessage";
import { fetchGmail, gmailEmail, sendGmail } from "./gmail";
import { ImapSmtpConfig, fetchImap, sendSmtp, verifyImapSmtp } from "./imap";
import { Tokens, Vendor, refreshTokens } from "./oauth";
import { fetchOutlook, outlookEmail, sendOutlook } from "./outlook";
import { MAIL_PRESETS, MAIL_PROVIDERS } from "./providers";
import type { Fetched } from "./types";

type Doc = HydratedDocument<any>;

export const toMailAccountDTO = (d: Doc): MailAccountDTO => ({
    id: d._id.toString(),
    provider: d.config.provider,
    email: d.config.email,
    status: d.status,
    error: d.error,
    lastSyncAt: d.lastSyncAt ? (d.lastSyncAt as Date).toISOString() : "",
});

export const toMailDTO = (m: Doc, withBody: boolean): MailDTO => ({
    id: m._id.toString(),
    accountId: m.account.toString(),
    folder: m.folder,
    from: m.from,
    to: m.to,
    subject: m.subject,
    body: withBody ? m.body : "",
    at: (m.at as Date).toISOString(),
    starred: m.starred,
    snoozed: m.snoozed,
    read: m.read,
});

// ── доступ к ящику ────────────────────────────────────────────────────────────

const imapConfig = (d: Doc): ImapSmtpConfig => ({ email: d.config.email, ...d.config.server, password: secretsOf(d).password });
const isOAuth = (d: Doc) => d.config.authType === "oauth";

// Токен OAuth живёт около часа: перед запросом при необходимости обновляем его по refresh-токену
async function accessToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) throw new ProviderError("Sign in to this mailbox again");
    const fresh = await refreshTokens(d.config.vendor as Vendor, s.refreshToken);
    d.secrets = packSecrets(fresh);
    await d.save();
    return fresh.accessToken;
}

async function fetchAll(d: Doc, known: Set<string>): Promise<Fetched[]> {
    if (!isOAuth(d)) return fetchImap(imapConfig(d));
    const token = await accessToken(d);
    return d.config.vendor === "google" ? fetchGmail(token, known) : fetchOutlook(token);
}

// Загружает новые письма в базу. Уже известные письма не перезаписываются: прочитано/звезда/«отложено» меняются в CRM.
export async function syncAccount(d: Doc) {
    const owner = d.owner.toString();
    try {
        const known = new Set<string>((await MailMessage.find({ account: d._id }).select("externalId").lean()).map((m: { externalId: string }) => m.externalId));
        const fetched = await fetchAll(d, known);
        const ops = fetched.map((m) => ({
            updateOne: {
                filter: { account: d._id, externalId: m.externalId },
                update: { $setOnInsert: { owner, folder: m.folder, from: m.from, to: m.to, subject: m.subject, body: m.body, at: m.at, read: m.read, starred: m.starred } },
                upsert: true,
            },
        }));
        if (ops.length) await MailMessage.bulkWrite(ops, { ordered: false });
        d.status = "connected";
        d.error = "";
        d.lastSyncAt = new Date();
        await d.save();
        return ops.length;
    } catch (e) {
        const err = e instanceof ProviderError ? e : new ProviderError("Could not load the mailbox");
        d.status = "error";
        d.error = err.message;
        await d.save();
        throw err;
    }
}

// Отправка письма. Копию в «Отправленных» сохраняем сразу (для Outlook её подтянет синхронизация).
export async function sendFromAccount(d: Doc, msg: { to: string; subject: string; text: string }) {
    const owner = d.owner.toString();
    const email: string = d.config.email;
    let externalId: string | null;
    if (!isOAuth(d)) {
        externalId = await sendSmtp(imapConfig(d), msg);
    } else if (d.config.vendor === "google") {
        externalId = await sendGmail(await accessToken(d), { from: email, ...msg });
    } else {
        await sendOutlook(await accessToken(d), msg);
        externalId = null;
        await syncAccount(d).catch(() => undefined);
    }
    if (!externalId) return null;
    return MailMessage.create({ owner, account: d._id, externalId, folder: "sent", from: email, to: msg.to, subject: msg.subject, body: msg.text, at: new Date(), read: true });
}

// ── подключение ───────────────────────────────────────────────────────────────

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const port = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
};

async function upsertAccount(owner: string, email: string, config: Record<string, unknown>, secrets: unknown) {
    const doc = (await Integration.findOne({ owner, type: "mail", "config.email": email })) ?? new Integration({ owner, type: "mail", token: randomToken() });
    doc.set({ name: email, config: { ...config, email }, secrets: packSecrets(secrets), status: "connected", error: "" });
    await doc.save();
    return doc;
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
    await MailMessage.deleteMany({ account: d._id });
    await Integration.deleteOne({ _id: d._id });
}
