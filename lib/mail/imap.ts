import { ImapFlow } from "imapflow";
import { simpleParser, AddressObject } from "mailparser";
import nodemailer from "nodemailer";
import { randomToken } from "@/lib/crypto";
import { ProviderError } from "@/lib/http";
import { assertPublicHost } from "./hosts";
import type { Fetched, MailAttachment, MailTrashFailure, MailTrashItem } from "./types";

export interface ImapSmtpConfig {
    email: string;
    password: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
}

// Понятное сообщение вместо технической ошибки библиотеки. Ответ самого сервера (например, у Gmail
// «Application-specific password required») добавляем в конец: по нему видно, что именно отклонено.
export function mailError(e: unknown, stage?: "IMAP" | "SMTP"): ProviderError {
    if (e instanceof ProviderError) return e;
    const err = e as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string; response?: string };
    const server = (err.responseText || err.response || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const detail = server ? ` Server said: ${server}` : "";
    if (err.authenticationFailed || err.code === "EAUTH") {
        const where = stage ? ` (${stage} login was rejected)` : "";
        return new ProviderError(`Invalid email or password${where}. Gmail, iCloud and Yahoo need an app password, not the account password.${detail}`);
    }
    if (err.code === "ENOTFOUND" || err.code === "EDNS") return new ProviderError("Mail server was not found. Check the server address.");
    if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT" || err.code === "ESOCKET" || err.code === "ECONNECTION") return new ProviderError("Could not connect to the mail server. Check the address and port.");
    return new ProviderError(server || err.message || "Mail server error");
}

function client(c: ImapSmtpConfig) {
    const imap = new ImapFlow({
        host: c.imapHost,
        port: c.imapPort,
        secure: c.imapPort === 993,
        auth: { user: c.email, pass: c.password },
        logger: false,
        socketTimeout: 25000,
        greetingTimeout: 10000,
    });
    imap.on("error", () => { /* ошибки приходят из вызовов; без обработчика 'error' Node роняет процесс */ });
    return imap;
}

function smtp(c: ImapSmtpConfig) {
    return nodemailer.createTransport({
        host: c.smtpHost,
        port: c.smtpPort,
        secure: c.smtpPort === 465,
        auth: { user: c.email, pass: c.password },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
    });
}

// Проверка при подключении: вход в IMAP и в SMTP
export async function verifyImapSmtp(c: ImapSmtpConfig) {
    await assertPublicHost(c.imapHost);
    await assertPublicHost(c.smtpHost);
    const imap = client(c);
    try {
        await imap.connect();
        await imap.logout();
    } catch (e) {
        imap.close();
        throw mailError(e, "IMAP");
    }
    try {
        await smtp(c).verify();
    } catch (e) {
        throw mailError(e, "SMTP");
    }
}

// Рассылки и автоответы: у них есть List-Unsubscribe, Precedence: bulk/list/junk или Auto-Submitted
const isBulk = (h: Map<string, unknown>) => {
    const precedence = String(h.get("precedence") ?? "").toLowerCase();
    const auto = String(h.get("auto-submitted") ?? "").toLowerCase();
    return h.has("list-unsubscribe") || ["bulk", "list", "junk"].includes(precedence) || (!!auto && auto !== "no");
};

// «Имя <адрес>» без кавычек вокруг имени (mailparser.text оставляет их)
const addressText = (a?: AddressObject | AddressObject[]) =>
    (Array.isArray(a) ? a : a ? [a] : [])
        .flatMap((x) => x.value)
        .map((v) => (v.name && v.address ? `${v.name} <${v.address}>` : v.address || v.name || ""))
        .filter(Boolean)
        .join(", ");

export async function sendSmtp(c: ImapSmtpConfig, msg: { to: string; subject: string; text: string; html?: string; attachments?: MailAttachment[] }) {
    await assertPublicHost(c.smtpHost);
    const domain = c.email.split("@")[1] || "localhost";
    const messageId = `<${randomToken(12)}@${domain}>`;
    try {
        // html и text вместе дают multipart/alternative: форматирование видят современные клиенты,
        // обычный текст — остальные (и поиск в почте)
        await smtp(c).sendMail({ from: c.email, to: msg.to, subject: msg.subject, text: msg.text, ...(msg.html ? { html: msg.html } : {}), messageId, attachments: msg.attachments });
    } catch (e) {
        throw mailError(e, "SMTP");
    }
    return messageId; // по нему письмо из папки Sent при синхронизации опознаётся как уже сохранённое
}

// Тело одного письма из ящика: письмо опознаётся по Message-ID, а если его не было — по uid,
// который сохранён в виде «uid:папка:номер» (см. fetchImap)
export async function fetchImapMessage(c: ImapSmtpConfig, externalId: string): Promise<{ html: string; text: string }> {
    await assertPublicHost(c.imapHost);
    const imap = client(c);
    try {
        await imap.connect();
        const byUid = /^uid:([^:]+):(\d+)$/.exec(externalId);
        let uid: number | null = null;
        let path = "INBOX";
        if (byUid) {
            path = byUid[1];
            uid = Number(byUid[2]);
        } else {
            const lock = await imap.getMailboxLock("INBOX");
            try {
                const found = await imap.search({ header: { "message-id": externalId } }, { uid: true });
                uid = Array.isArray(found) && found.length ? found[found.length - 1] : null;
            } finally {
                lock.release();
            }
        }
        if (!uid) return { html: "", text: "" };
        const lock = await imap.getMailboxLock(path);
        try {
            const m = await imap.fetchOne(String(uid), { source: true }, { uid: true });
            if (!m || !m.source) return { html: "", text: "" };
            const parsed = await simpleParser(m.source);
            return { html: parsed.html ? String(parsed.html) : "", text: parsed.text ?? "" };
        } finally {
            lock.release();
        }
    } catch (e) {
        imap.close();
        throw mailError(e, "IMAP");
    } finally {
        try { await imap.logout(); } catch { /* соединение уже закрыто */ }
    }
}

// Удаление на стороне IMAP: письмо перемещается в «Корзину» (Trash), а не стирается навсегда.
// Сначала ищем папку корзины по special-use \Trash (Gmail: «[Gmail]/Trash», Яндекс: «Удалённые»,
// iCloud: «Deleted Messages»), затем по известным названиям. Если MOVE сервер не умеет, ImapFlow
// сам делает COPY + \Deleted + EXPUNGE в исходной папке — сама корзина не чистится.
// Возвращаем отказы по одному письму: успешно перемещённые CRM вправе помечать удалёнными.
const TRASH_NAME = /(^|\/)(trash|bin|deleted(\s*(items|messages))?|papierkorb|corbeille|papelera|kosz|кошик|удал[её]нные|корзина)(\/|$)/i;

export async function trashImapMessages(c: ImapSmtpConfig, items: MailTrashItem[]): Promise<MailTrashFailure[]> {
    await assertPublicHost(c.imapHost);
    const imap = client(c);
    const failures: MailTrashFailure[] = [];
    try {
        await imap.connect();
        const boxes = await imap.list();
        const sentPath = boxes.find((b) => b.specialUse === "\\Sent")?.path ?? boxes.find((b) => /^(inbox\.)?sent( items| messages| mail)?$/i.test(b.path))?.path;
        const trashPath = boxes.find((b) => b.specialUse === "\\Trash" && b.path !== "INBOX")?.path ?? boxes.find((b) => TRASH_NAME.test(b.path))?.path;
        // «All Mail» Gmail: письмо могло быть заархивировано после синхронизации, и в INBOX его уже нет
        const allPath = boxes.find((b) => b.specialUse === "\\All" && b.path !== "INBOX")?.path;

        const moveOut = async (path: string, uid: number): Promise<boolean> => {
            // корзину не чистим: в Trash Gmail EXPUNGE удалил бы письмо навсегда, поэтому только MOVE/COPY
            if (trashPath && trashPath !== path) {
                const moved = await imap.messageMove(String(uid), trashPath, { uid: true });
                return moved !== false && moved !== undefined;
            }
            const deleted = await imap.messageDelete(String(uid), { uid: true });
            return deleted === true;
        };

        type Pending = { item: MailTrashItem; uid: number | null; explicit: boolean };
        const groups = new Map<string, Pending[]>();
        const missing: MailTrashItem[] = []; // не нашли в ожидаемой папке — попробуем в «All Mail»
        const add = (path: string, pending: Pending) => {
            const list = groups.get(path) ?? [];
            list.push(pending);
            groups.set(path, list);
        };
        for (const item of items) {
            const byUid = /^uid:([^:]+):(\d+)$/.exec(item.externalId);
            if (byUid) add(byUid[1], { item, uid: Number(byUid[2]), explicit: true });
            else add(item.folder === "sent" ? sentPath ?? "INBOX" : "INBOX", { item, uid: null, explicit: false });
        }

        const search = async (item: MailTrashItem): Promise<number | null> => {
            const found = await imap.search({ header: { "message-id": item.externalId } }, { uid: true });
            return Array.isArray(found) && found.length ? found[found.length - 1] : null;
        };

        for (const [path, list] of Array.from(groups.entries())) {
            const lock = await imap.getMailboxLock(path);
            try {
                for (const pending of list) {
                    const uid = pending.explicit ? pending.uid : await search(pending.item);
                    if (!uid) {
                        if (!pending.explicit) missing.push(pending.item);
                        continue;
                    }
                    if (!(await moveOut(path, uid))) failures.push({ id: pending.item.id, message: "The mail server did not move the e-mail to Trash" });
                }
            } finally {
                lock.release();
            }
        }

        // Письмо не нашлось в своей папке: ищем в «All Mail» (архив Gmail) — оттуда MOVE в Trash тоже работает
        if (missing.length && allPath) {
            const lock = await imap.getMailboxLock(allPath);
            try {
                for (const item of missing) {
                    const uid = await search(item);
                    if (!uid) continue; // провайдер уже не знает об этом письме — локально его можно убрать
                    if (!(await moveOut(allPath, uid))) failures.push({ id: item.id, message: "The mail server did not move the e-mail to Trash" });
                }
            } finally {
                lock.release();
            }
        }
    } catch (e) {
        imap.close();
        const err = mailError(e, "IMAP");
        // Соединение/папка не открылись — виноват сервер. Отказываем всем письмам пачки, чтобы CRM их не удаляла.
        return items.map((i) => ({ id: i.id, message: err.message }));
    } finally {
        try { await imap.logout(); } catch { /* соединение уже закрыто */ }
    }
    return failures;
}

// Последние письма из «Входящих» и «Отправленных»
export async function fetchImap(c: ImapSmtpConfig, limit = 40): Promise<Fetched[]> {
    await assertPublicHost(c.imapHost);
    const imap = client(c);
    const out: Fetched[] = [];
    try {
        await imap.connect();
        const boxes = await imap.list();
        const sent = boxes.find((b) => b.specialUse === "\\Sent")?.path ?? boxes.find((b) => /^(inbox\.)?sent( items| messages| mail)?$/i.test(b.path))?.path;
        for (const [path, folder] of [["INBOX", "inbox"], [sent, "sent"]] as const) {
            if (!path) continue;
            const lock = await imap.getMailboxLock(path);
            try {
                const total = imap.mailbox && imap.mailbox.exists;
                if (!total) continue;
                const start = Math.max(1, total - limit + 1);
                // Сначала список (размер, флаги, дата), затем тело каждого письма. Небольшие письма скачиваем целиком,
                // у крупных (с вложениями) берём только начало — текст письма в нём, а вложения нам не нужны.
                const metas: { uid: number; size: number; flags?: Set<string>; internalDate?: Date | string }[] = [];
                for await (const m of imap.fetch(`${start}:*`, { uid: true, flags: true, size: true, internalDate: true })) {
                    metas.push({ uid: m.uid, size: m.size ?? 0, flags: m.flags, internalDate: m.internalDate });
                }
                for (const meta of metas) {
                    const m = await imap.fetchOne(String(meta.uid), { source: meta.size > 500_000 ? { maxLength: 150_000 } : true }, { uid: true });
                    if (!m || !m.source || m.source.length === 0) continue; // пусто — не сохраняем, письмо загрузится при следующей синхронизации
                    const p = await simpleParser(m.source);
                    out.push({
                        externalId: p.messageId || `uid:${path}:${meta.uid}`,
                        folder,
                        from: addressText(p.from),
                        to: addressText(p.to),
                        subject: p.subject ?? "",
                        body: (p.text ?? "").slice(0, 20000),
                        at: p.date ?? (meta.internalDate ? new Date(meta.internalDate) : new Date()),
                        read: meta.flags?.has("\\Seen") ?? false,
                        starred: meta.flags?.has("\\Flagged") ?? false,
                        bulk: isBulk(p.headers),
                    });
                }
            } finally {
                lock.release();
            }
        }
        await imap.logout();
    } catch (e) {
        imap.close();
        throw mailError(e, "IMAP");
    }
    return out;
}
