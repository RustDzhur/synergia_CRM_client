import type { HydratedDocument } from "mongoose";
import type { DocItemDTO, DocsState, FolderDTO } from "@/app/types/documents";
import { oauthAvailable } from "@/lib/mail/oauth";
import { storageConfigured } from "@/lib/storage/firebase";
import { findDrive } from "@/lib/google";
import DocFolder from "@/models/DocFolder";
import DocItem from "@/models/DocItem";

type Doc = HydratedDocument<any>;

export const MAX_UPLOAD_MB = 4; // предел размера запроса у функций Vercel — 4,5 МБ
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const QUOTA_BYTES = 500 * 1024 * 1024; // на пользователя

export const toFolderDTO = (f: Doc): FolderDTO => ({ id: f._id.toString(), name: f.name, parent: f.parent ? f.parent.toString() : null });

export const toDocDTO = (d: Doc): DocItemDTO => ({
    id: d._id.toString(),
    kind: d.kind,
    name: d.name,
    folder: d.folder ? d.folder.toString() : null,
    archived: !!d.archived,
    createdBy: d.createdByName,
    url: d.url,
    mime: d.mime,
    size: d.size,
    modifiedAt: ((d.modifiedAt as Date | undefined) ?? d.updatedAt ?? d.createdAt).toISOString(),
    createdAt: d.createdAt.toISOString(),
});

export async function docsState(owner: string): Promise<DocsState> {
    const [folders, docs, drive] = await Promise.all([
        DocFolder.find({ owner }).sort({ name: 1 }),
        DocItem.find({ owner }).sort({ createdAt: -1 }),
        findDrive(owner),
    ]);
    return {
        folders: folders.map(toFolderDTO),
        docs: docs.map(toDocDTO),
        drive: { configured: oauthAvailable().google, connected: !!drive && drive.status === "connected", email: drive?.config?.email ?? "" },
        storage: { configured: storageConfigured(), maxMb: MAX_UPLOAD_MB },
    };
}

// Имя документа/папки: без управляющих символов и угловых скобок, не длиннее max
export const cleanName = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\p{Cc}<>]/gu, "").trim().slice(0, max) : "");

// Имя файла для хранилища: только безопасные символы
export const safeFileName = (name: string) => cleanName(name, 120).replace(/[\\/:*?"|]/g, "_").replace(/^\.+/, "") || "file";

// Папка должна принадлежать пользователю; null — корень, undefined — не найдена
export async function ownedFolder(owner: string, id: unknown): Promise<Doc | null | undefined> {
    if (id === null || id === undefined || id === "") return null;
    if (typeof id !== "string") return undefined;
    try {
        return (await DocFolder.findOne({ _id: id, owner })) ?? undefined;
    } catch {
        return undefined;
    }
}

// Все потомки папки (для защиты от цикла при переносе)
export async function descendantIds(owner: string, root: string) {
    const all = (await DocFolder.find({ owner }).select("parent").lean()) as unknown as { _id: { toString(): string }; parent?: { toString(): string } | null }[];
    const out = new Set<string>();
    const walk = (id: string) => {
        for (const f of all) {
            if (f.parent?.toString() === id && !out.has(f._id.toString())) {
                out.add(f._id.toString());
                walk(f._id.toString());
            }
        }
    };
    walk(root);
    return out;
}
