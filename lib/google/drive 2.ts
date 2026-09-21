import { ProviderError, fetchProvider } from "@/lib/http";
import type { DocKind } from "@/app/types/documents";

// Google Drive API v3 без SDK. Работаем со scope drive.file: приложение видит и меняет только те файлы и папки, которые создало само.
// Адрес можно переопределить (для проверки без настоящего аккаунта).
const base = () => (process.env.GOOGLE_DRIVE_API_URL || "https://www.googleapis.com/drive/v3").replace(/\/+$/, "");

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const MIME: Record<Exclude<DocKind, "file"> | "folder", string> = {
    gdoc: "application/vnd.google-apps.document",
    gsheet: "application/vnd.google-apps.spreadsheet",
    gslide: "application/vnd.google-apps.presentation",
    folder: "application/vnd.google-apps.folder",
};
const FIELDS = "id,name,mimeType,modifiedTime,webViewLink,trashed,parents";

export interface DriveFile { id: string; name: string; mimeType?: string; modifiedTime?: string; webViewLink?: string; trashed?: boolean; parents?: string[] }

async function drive<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
    if (!res.ok || !json) {
        const msg = json?.error?.message ?? `Google Drive error ${res.status}`;
        throw new ProviderError(res.status === 403 && /not been used|disabled/i.test(msg) ? "Google Drive API is not enabled in your Google Cloud project" : msg);
    }
    return json;
}

// Адрес Google-аккаунта, к которому подключён Drive (для подписи «Connected as …»)
export async function driveUser(token: string) {
    const r = await drive<{ user?: { emailAddress?: string } }>(token, "/about?fields=user(emailAddress)");
    return r.user?.emailAddress ?? "";
}

export const createFolder = (token: string, name: string, parent?: string) =>
    drive<DriveFile>(token, `/files?fields=${FIELDS}`, { method: "POST", body: JSON.stringify({ name, mimeType: MIME.folder, parents: parent ? [parent] : undefined }) });

export const createGoogleFile = (token: string, kind: Exclude<DocKind, "file">, name: string, parent?: string) =>
    drive<DriveFile>(token, `/files?fields=${FIELDS}`, { method: "POST", body: JSON.stringify({ name, mimeType: MIME[kind], parents: parent ? [parent] : undefined }) });

export const getFile = (token: string, id: string) => drive<DriveFile>(token, `/files/${encodeURIComponent(id)}?fields=${FIELDS}`);

export function updateFile(token: string, id: string, patch: { name?: string; trashed?: boolean; addParent?: string; removeParents?: string[] }) {
    const q = new URLSearchParams({ fields: FIELDS });
    if (patch.addParent) q.set("addParents", patch.addParent);
    if (patch.removeParents?.length) q.set("removeParents", patch.removeParents.join(","));
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.trashed !== undefined) body.trashed = patch.trashed;
    return drive<DriveFile>(token, `/files/${encodeURIComponent(id)}?${q}`, { method: "PATCH", body: JSON.stringify(body) });
}

// Файлы приложения с данным признаком корзины (для синхронизации имён, дат изменения и удалений)
export async function listAppFiles(token: string, trashed: boolean) {
    const q = new URLSearchParams({ q: `trashed = ${trashed}`, pageSize: "1000", fields: `files(${FIELDS})` });
    const r = await drive<{ files?: DriveFile[] }>(token, `/files?${q}`);
    return r.files ?? [];
}
