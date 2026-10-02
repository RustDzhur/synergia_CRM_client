import type { DocItemDTO, DocsState, FolderDTO } from "@/types/documents";
import { planFor } from "@/config/plans";
import { effectivePlan } from "@/lib/billing";
import { oauthAvailable } from "@/lib/mail/oauth";
import { storageConfigured } from "@/lib/storage";
import { findDrive } from "@/lib/google";
import { findOnedrive } from "@/lib/onedrive";
import { prisma } from "@/lib/prisma";

type Doc = any;

export const MAX_UPLOAD_MB = 4; // предел размера запроса у функций Vercel — 4,5 МБ
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Сколько файлов и фото может хранить фирма всего — зависит от тарифа (app/config/plans.ts)
export async function quotaBytes(org: string): Promise<number> {
    const o = await prisma.organization.findUnique({ where: { id: org }, select: { plan: true, planOverride: true, planOverrideUntil: true } });
    return planFor(effectivePlan(o ?? {})).storageMb * 1024 * 1024;
}

export const toFolderDTO = (f: Doc): FolderDTO => ({ id: f.id, name: f.name, parent: f.parent ?? null });

export const toDocDTO = (d: Doc): DocItemDTO => {
    // Внешнее хранилище документа. У записей, заведённых до появления OneDrive, поле cloud пустое,
    // но driveId заполнен — это Google Drive, и такие документы должны попадать в свою вкладку.
    const cloud: DocItemDTO["cloud"] = d.cloud === "onedrive" ? "onedrive" : d.driveId ? "google" : "";
    return {
        id: d.id,
        kind: d.kind,
        name: d.name,
        folder: d.folder ?? null,
        archived: !!d.archived,
        createdBy: d.createdByName,
        url: d.url,
        mime: d.mime,
        size: d.size,
        imported: !!d.imported,
        // cloud — где живёт документ: "google", "onedrive" или у нас (""). По этому признаку
        // раздел делится на вкладки — своё хранилище и каждое подключённое
        cloud,
        onDrive: cloud !== "",
        modifiedAt: ((d.modifiedAt as Date | undefined) ?? d.updatedAt ?? d.createdAt).toISOString(),
        createdAt: d.createdAt.toISOString(),
    };
};

export async function docsState(owner: string): Promise<DocsState> {
    const [folders, docs, drive, onedrive, quota] = await Promise.all([
        prisma.docFolder.findMany({ where: { owner }, orderBy: { name: "asc" } }),
        prisma.docItem.findMany({ where: { owner }, orderBy: { createdAt: "desc" } }),
        findDrive(owner),
        findOnedrive(owner),
        quotaBytes(owner),
    ]);
    const isGoogle = (d: Doc) => (d.cloud === "onedrive" ? false : !!d.driveId);
    const isOnedrive = (d: Doc) => d.cloud === "onedrive";
    return {
        folders: folders.map(toFolderDTO),
        docs: docs.map(toDocDTO),
        drive: {
            configured: oauthAvailable().google,
            connected: !!drive && drive.status === "connected",
            email: String((drive?.config as any)?.email ?? ""),
            // сколько документов ссылаются на файлы Google: при отключении аккаунта они остаются
            // в списке (файлы не удаляем), и об этом честно предупреждаем в интерфейсе
            googleDocs: docs.filter(isGoogle).length,
        },
        onedrive: {
            configured: oauthAvailable().microsoft,
            connected: !!onedrive && onedrive.status === "connected",
            email: String((onedrive?.config as any)?.email ?? ""),
            docs: docs.filter(isOnedrive).length,
        },
        storage: {
            configured: storageConfigured(),
            maxMb: MAX_UPLOAD_MB, // предел одного файла
            quotaMb: Math.round(quota / 1024 / 1024), // выделено тарифом
            // занято файлами, которые лежат у нас: документы Google и OneDrive занимают место у своих
            // сервисов, а не в тарифе, поэтому в занятое не входят
            usedMb: Math.round(docs.reduce((sum, d) => sum + (d.kind === "file" && !d.driveId ? Number(d.size) || 0 : 0), 0) / 1024 / 1024),
        },
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
        return (await prisma.docFolder.findFirst({ where: { id, owner } })) ?? undefined;
    } catch {
        return undefined;
    }
}

// Все потомки папки (для защиты от цикла при переносе)
export async function descendantIds(owner: string, root: string) {
    const all = await prisma.docFolder.findMany({ where: { owner }, select: { id: true, parent: true } });
    const out = new Set<string>();
    const walk = (id: string) => {
        for (const f of all) {
            if (f.parent === id && !out.has(f.id)) {
                out.add(f.id);
                walk(f.id);
            }
        }
    };
    walk(root);
    return out;
}
