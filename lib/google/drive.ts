import { ProviderError, fetchProvider } from "@/lib/http";
import type { DocKind } from "@/app/types/documents";

// Google Drive API v3 без SDK. Два права: drive.file — приложение видит и меняет только те файлы, которые создало само,
// drive.readonly — читает все файлы пользователя (нужно, чтобы показать в CRM и перенести туда то, что у него уже лежало на Диске).
// Адрес можно переопределить (для проверки без настоящего аккаунта).
const base = () => (process.env.GOOGLE_DRIVE_API_URL || "https://www.googleapis.com/drive/v3").replace(/\/+$/, "");

// Права действуют только с момента подключения: в токене, сохранённом раньше, drive.readonly нет,
// поэтому уже подключённый Диск нужно подключить заново (кнопка «Переподключить» на странице онлайн-документов).
// Для drive.readonly Google, пока проект в Cloud Console не проверен, показывает предупреждение «приложение не проверено»:
// это ожидаемо — пользователь нажимает «Дополнительные настройки» → «Перейти в … (небезопасно)» и видит обычный экран согласия.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file";
export const MIME: Record<Exclude<DocKind, "file"> | "folder", string> = {
    gdoc: "application/vnd.google-apps.document",
    gsheet: "application/vnd.google-apps.spreadsheet",
    gslide: "application/vnd.google-apps.presentation",
    folder: "application/vnd.google-apps.folder",
};
const FIELDS = "id,name,mimeType,modifiedTime,webViewLink,trashed,parents";

export interface DriveFile { id: string; name: string; mimeType?: string; modifiedTime?: string; webViewLink?: string; trashed?: boolean; parents?: string[] }

// Диск подключён со старыми правами (только drive.file): Google отдаёт файлы, созданные самим CRM, а на запрос всего Диска
// отвечает 403 «request had insufficient authentication scopes». Отдельная ошибка — чтобы маршрут импорта предложил подключиться заново.
export class DriveScopeError extends ProviderError {}

async function drive<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetchProvider(`${base()}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
    if (!res.ok || !json) {
        const msg = json?.error?.message ?? `Google Drive error ${res.status}`;
        if (res.status === 403) {
            if (/not been used|disabled/i.test(msg)) throw new ProviderError("Google Drive API is not enabled in your Google Cloud project");
            if (/insufficient|scope/i.test(msg)) throw new DriveScopeError("Reconnect Google Drive to give the CRM access to the files already in your Drive.");
        }
        throw new ProviderError(msg);
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

// Страница файлов с данным признаком корзины (для синхронизации имён, дат изменения и удалений).
// После расширения прав сюда попадают все файлы пользователя, а не только созданные CRM, — синхронизация
// сверяет их с известными ей driveId, поэтому лишние ничего не меняют.
export async function listAppFiles(token: string, trashed: boolean) {
    const q = new URLSearchParams({ q: `trashed = ${trashed}`, pageSize: "1000", fields: `files(${FIELDS})` });
    const r = await drive<{ files?: DriveFile[] }>(token, `/files?${q}`);
    return r.files ?? [];
}

// Файлы пользователя на Диске (без корзины), страницами: parent — смотреть внутри папки Диска,
// pageToken — следующая страница (значение nextPageToken из предыдущего ответа). Порядок — по имени.
export async function listDriveFiles(token: string, opts: { parent?: string; pageToken?: string } = {}) {
    const query = new URLSearchParams({
        q: ["trashed = false", opts.parent ? `'${opts.parent.replace(/'/g, "\\'")}' in parents` : ""].filter(Boolean).join(" and "),
        fields: `files(${FIELDS}),nextPageToken`,
        orderBy: "name",
        pageSize: "100",
    });
    if (opts.pageToken) query.set("pageToken", opts.pageToken);
    const r = await drive<{ files?: DriveFile[]; nextPageToken?: string }>(token, `/files?${query}`);
    return { files: r.files ?? [], nextPageToken: r.nextPageToken ?? "" };
}
