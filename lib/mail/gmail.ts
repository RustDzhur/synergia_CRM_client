import MailComposer from "nodemailer/lib/mail-composer";
import { ProviderError, fetchProvider } from "@/lib/http";
import type { Fetched, MailAttachment } from "./types";

const base = () => (process.env.GMAIL_API_URL || "https://gmail.googleapis.com/gmail/v1/users/me").replace(/\/+$/, "");

async function gmail<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !json) throw new ProviderError(json?.error?.message ?? `Gmail error ${res.status}`);
    return json;
}

export const gmailEmail = async (token: string) => (await gmail<{ emailAddress: string }>(token, "/profile")).emailAddress;

interface Part { mimeType?: string; body?: { data?: string }; parts?: Part[] }
interface GMessage { id: string; internalDate?: string; labelIds?: string[]; payload?: Part & { headers?: { name: string; value: string }[] } }

const decode = (data?: string) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");
const stripHtml = (html: string) => html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

function findPart(p: Part | undefined, type: string): string {
    if (!p) return "";
    if (p.mimeType === type && p.body?.data) return decode(p.body.data);
    for (const child of p.parts ?? []) {
        const found = findPart(child, type);
        if (found) return found;
    }
    return "";
}

function toFetched(m: GMessage, folder: "inbox" | "sent"): Fetched {
    const h = (name: string) => (m.payload?.headers?.find((x) => x.name.toLowerCase() === name)?.value ?? "").replace(/"([^"]*)"\s*</g, "$1 <");
    const text = findPart(m.payload, "text/plain") || stripHtml(findPart(m.payload, "text/html"));
    const precedence = h("precedence").toLowerCase();
    const bulk =
        !!h("list-unsubscribe") ||
        ["bulk", "list", "junk"].includes(precedence) ||
        (!!h("auto-submitted") && h("auto-submitted").toLowerCase() !== "no") ||
        !!m.labelIds?.some((l) => ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_UPDATES", "CATEGORY_FORUMS"].includes(l));
    return {
        externalId: m.id,
        folder,
        from: h("from"),
        to: h("to"),
        subject: h("subject"),
        body: text.slice(0, 20000),
        at: new Date(Number(m.internalDate) || Date.now()),
        read: !m.labelIds?.includes("UNREAD"),
        starred: !!m.labelIds?.includes("STARRED"),
        bulk,
    };
}

// Последние письма из INBOX и SENT; полностью загружаем только те, которых ещё нет в базе
export async function fetchGmail(token: string, known: Set<string>, limit = 30): Promise<Fetched[]> {
    const out: Fetched[] = [];
    for (const [label, folder] of [["INBOX", "inbox"], ["SENT", "sent"]] as const) {
        const list = await gmail<{ messages?: { id: string }[] }>(token, `/messages?labelIds=${label}&maxResults=${limit}`);
        const fresh = (list.messages ?? []).filter((m) => !known.has(m.id));
        for (let i = 0; i < fresh.length; i += 8) {
            const chunk = await Promise.all(fresh.slice(i, i + 8).map((m) => gmail<GMessage>(token, `/messages/${m.id}?format=full`)));
            out.push(...chunk.map((m) => toFetched(m, folder)));
        }
    }
    return out;
}

// Тело одного письма (HTML и текст) — для писем, загруженных до того, как мы начали хранить разметку
export async function gmailMessageBody(token: string, id: string) {
    const m = await gmail<GMessage>(token, `/messages/${id}?format=full`);
    return { html: findPart(m.payload, "text/html"), text: findPart(m.payload, "text/plain") };
}

export async function sendGmail(token: string, msg: { from: string; to: string; subject: string; text: string; html?: string; attachments?: MailAttachment[] }) {
    // MailComposer собирает MIME целиком: text + html дают multipart/alternative, а вложения —
    // отдельную часть (raw — то, что ждёт /messages/send)
    const raw: Buffer = await new Promise((resolve, reject) =>
        new MailComposer(msg).compile().build((err, buf) => (err ? reject(err) : resolve(buf)))
    );
    const res = await gmail<{ id: string }>(token, "/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: raw.toString("base64url") }),
    });
    return res.id;
}

// Удаление через Gmail API: users.messages.trash. Письмо попадает в корзину Gmail и может быть
// восстановлено пользователем — это не безвозвратное удаление. 404 значит, что письма уже нет
// (удалено в другом клиенте) и локальную запись можно убирать.
export async function trashGmailMessages(token: string, items: { id: string; externalId: string }[]): Promise<{ id: string; message: string }[]> {
    const failures: { id: string; message: string }[] = [];
    const queue = [...items];
    // По 4 запроса одновременно: пачка из десятков писем не упирается в таймаут, а лимиты Gmail не рвутся
    const worker = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
            try {
                await gmail(token, `/messages/${encodeURIComponent(item.externalId)}/trash`, { method: "POST" });
            } catch (e) {
                const message = e instanceof Error ? e.message : "Gmail did not confirm the deletion";
                if (/not found|404|requested entity was not found/i.test(message)) continue;
                // Согласие только на чтение/отправку (старое подключение): Google не разрешает trash
                if (/insufficient|permission|forbidden|403|unauthorized/i.test(message)) {
                    failures.push({ id: item.id, message: "The mailbox does not allow deleting messages. Reconnect it and allow Gmail access to modify mail." });
                    continue;
                }
                failures.push({ id: item.id, message });
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, items.length) }, worker));
    return failures;
}
