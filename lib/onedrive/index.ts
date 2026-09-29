import type { HydratedDocument } from "mongoose";
import { ProviderError, fetchProvider } from "@/lib/http";
import { packSecrets, secretsOf } from "@/lib/integrations";
import { randomToken } from "@/lib/crypto";
import { Tokens, refreshTokens } from "@/lib/mail/oauth";
import Integration from "@/models/Integration";

type Doc = HydratedDocument<any>;

// Microsoft Graph без SDK: тот же приём, что у Google Drive (lib/google/drive.ts), — обычные запросы
// с токеном. Адрес вынесен в переменную окружения, чтобы проверять на заглушке.
const graphUrl = () => (process.env.MS_GRAPH_URL || "https://graph.microsoft.com/v1.0").replace(/\/+$/, "");

async function graph<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchProvider(`${graphUrl()}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
    if (!res.ok || (!json && res.status !== 204)) throw new ProviderError(json?.error?.message ?? `OneDrive error ${res.status}`);
    return json as T;
}

interface OdItem {
    id: string;
    name?: string;
    size?: number;
    webUrl?: string;
    lastModifiedDateTime?: string;
    file?: { mimeType?: string };
    folder?: { childCount?: number };
}

export const onedriveEmail = async (token: string) => {
    const me = await graph<{ mail?: string; userPrincipalName?: string }>(token, "/me?$select=mail,userPrincipalName");
    return (me.mail || me.userPrincipalName || "").toLowerCase();
};

// Подключение OneDrive пользователя (одно на пользователя): токены зашифрованы, как у почты и Диска Google
export const findOnedrive = (owner: string) => Integration.findOne({ owner, type: "onedrive" });

export async function connectOnedrive(owner: string, tokens: Tokens) {
    if (!tokens.refreshToken) throw new ProviderError("Microsoft did not allow offline access. Connect OneDrive again.");
    const email = await onedriveEmail(tokens.accessToken).catch(() => "");
    const doc = (await findOnedrive(owner)) ?? new Integration({ owner, type: "onedrive", token: randomToken() });
    doc.set({ name: email || "OneDrive", config: { email }, secrets: packSecrets(tokens), status: "connected", error: "" });
    doc.markModified("config");
    await doc.save();
    return doc;
}

// Токен доступа живёт около часа: перед запросом при необходимости обновляем его по refresh-токену
export async function onedriveToken(d: Doc): Promise<string> {
    const s = secretsOf<Tokens>(d);
    if (s.expiresAt > Date.now() + 60_000) return s.accessToken;
    if (!s.refreshToken) throw new ProviderError("Connect OneDrive again");
    try {
        const fresh = await refreshTokens("microsoft", s.refreshToken);
        d.secrets = packSecrets(fresh);
        await d.save();
        return fresh.accessToken;
    } catch {
        d.status = "error";
        d.error = "OneDrive access was revoked. Connect it again.";
        await d.save();
        throw new ProviderError(d.error);
    }
}

// Сколько места занято и сколько выделено на OneDrive — как у Google Диска, для строки объёма
export async function onedriveQuota(token: string): Promise<{ usedBytes: number; limitBytes: number }> {
    const d = await graph<{ quota?: { used?: number; total?: number } }>(token, "/me/drive?$select=quota");
    return { usedBytes: Number(d.quota?.used ?? 0) || 0, limitBytes: Number(d.quota?.total ?? 0) || 0 };
}

export interface OdEntry {
    id: string;
    name: string;
    size: number;
    mime: string;
    url: string;
    folder: boolean;
    modified: string;
}

const toEntry = (i: OdItem): OdEntry => ({
    id: i.id,
    name: i.name ?? "",
    size: Number(i.size ?? 0) || 0,
    mime: i.file?.mimeType ?? "",
    url: i.webUrl ?? "",
    folder: !!i.folder,
    modified: i.lastModifiedDateTime ?? "",
});

// Файлы в корне OneDrive или в папке. Одна страница (до 200 записей) — этого хватает для переноса
// выбранных файлов; вложенные папки раскрываются по клику, отдельным запросом
export async function listOnedrive(token: string, folderId = ""): Promise<OdEntry[]> {
    const base = folderId ? `/me/drive/items/${encodeURIComponent(folderId)}/children` : "/me/drive/root/children";
    const res = await graph<{ value?: OdItem[] }>(token, `${base}?$top=200&$select=id,name,size,file,folder,webUrl,lastModifiedDateTime`);
    return (res.value ?? []).map(toEntry);
}

export async function onedriveItem(token: string, id: string): Promise<OdEntry | null> {
    try {
        const item = await graph<OdItem>(token, `/me/drive/items/${encodeURIComponent(id)}?$select=id,name,size,file,folder,webUrl,lastModifiedDateTime`);
        return toEntry(item);
    } catch {
        return null;
    }
}
