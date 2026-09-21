import { ProviderError, fetchProvider } from "@/lib/http";
import type { Fetched } from "./types";

const base = () => (process.env.MS_GRAPH_URL || "https://graph.microsoft.com/v1.0").replace(/\/+$/, "");

async function graph<T>(token: string, path: string, init: RequestInit = {}): Promise<T | null> {
    const res = await fetchProvider(`${base()}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"', ...(init.headers ?? {}) },
    });
    if (res.status === 202 || res.status === 204) return null;
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || !json) throw new ProviderError(json?.error?.message ?? `Outlook error ${res.status}`);
    return json;
}

export async function outlookEmail(token: string) {
    const me = await graph<{ mail?: string; userPrincipalName?: string }>(token, "/me?$select=mail,userPrincipalName");
    return me?.mail || me?.userPrincipalName || "";
}

interface Addr { emailAddress?: { name?: string; address?: string } }
interface OMessage {
    id: string;
    subject?: string;
    from?: Addr;
    toRecipients?: Addr[];
    body?: { content?: string };
    receivedDateTime?: string;
    sentDateTime?: string;
    isRead?: boolean;
    flag?: { flagStatus?: string };
    inferenceClassification?: string;
}
const addr = (a?: Addr) => (a?.emailAddress?.name && a.emailAddress.name !== a.emailAddress.address ? `${a.emailAddress.name} <${a.emailAddress.address}>` : a?.emailAddress?.address ?? "");

export async function fetchOutlook(token: string, limit = 30): Promise<Fetched[]> {
    const out: Fetched[] = [];
    for (const [folder, path] of [["inbox", "inbox"], ["sent", "sentitems"]] as const) {
        const q = `$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,from,toRecipients,body,receivedDateTime,sentDateTime,isRead,flag,inferenceClassification`;
        const res = await graph<{ value: OMessage[] }>(token, `/me/mailFolders/${path}/messages?${q}`);
        for (const m of res?.value ?? []) {
            out.push({
                externalId: m.id,
                folder,
                from: addr(m.from),
                to: (m.toRecipients ?? []).map(addr).join(", "),
                subject: m.subject ?? "",
                body: (m.body?.content ?? "").slice(0, 20000),
                at: new Date(m.receivedDateTime || m.sentDateTime || Date.now()),
                read: !!m.isRead,
                starred: m.flag?.flagStatus === "flagged",
                bulk: m.inferenceClassification === "other", // «Другие» в Outlook — рассылки и уведомления
            });
        }
    }
    return out;
}

export async function sendOutlook(token: string, msg: { to: string; subject: string; text: string }) {
    await graph(token, "/me/sendMail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: {
                subject: msg.subject,
                body: { contentType: "Text", content: msg.text },
                toRecipients: msg.to.split(",").map((a) => ({ emailAddress: { address: a.trim() } })),
            },
            saveToSentItems: true,
        }),
    });
}
