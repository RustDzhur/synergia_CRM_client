import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { cleanName } from "@/lib/documents";
import { driveToken, findDrive } from "@/lib/google";
import { DriveScopeError, MIME, listDriveFiles } from "@/lib/google/drive";
import type { DocKind } from "@/types/documents";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMPORT_LIMIT = 200; // столько файлов переносим за один запуск; повторный запуск доберёт следующие
const SCAN_PAGES = 10; // и не больше 1000 просмотренных файлов — чтобы запрос не растянулся

// Папки — это структура Диска, её CRM не зеркалит; ярлыки — ссылки на другие файлы, переносить их нечем
const SKIP = new Set<string>([MIME.folder, "application/vnd.google-apps.shortcut"]);

const kindOf = (mime?: string): DocKind => (mime === MIME.gdoc ? "gdoc" : mime === MIME.gsheet ? "gsheet" : mime === MIME.gslide ? "gslide" : "file");

// POST /api/documents/import-drive — переносит файлы, которые у пользователя уже лежат на Google Диске, в CRM.
// Повторный запуск ничего не дублирует: файл опознаётся по driveId и пропускается. Ответ — { imported, skipped, total }.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        const drive = await findDrive(user.id);
        if (!drive || drive.status !== "connected") return NextResponse.json({ message: "Connect Google Drive first" }, { status: 409 });
        const token = await driveToken(drive);

        const known = new Set<string>(
            (await prisma.docItem.findMany({ where: { owner: user.id, driveId: { not: "" } }, select: { driveId: true } })).map((d) => d.driveId ?? "")
        );
        const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const createdByName = me ? `${me.firstname} ${me.lastname}` : "";

        const fresh: Record<string, unknown>[] = [];
        let skipped = 0;
        let total = 0;
        let pageToken = "";
        for (let page = 0; page < SCAN_PAGES; page++) {
            const res = await listDriveFiles(token, { pageToken });
            total += res.files.length;
            for (const f of res.files) {
                if (SKIP.has(f.mimeType ?? "") || known.has(f.id)) { skipped += 1; continue; }
                if (fresh.length >= IMPORT_LIMIT) break;
                known.add(f.id);
                fresh.push({
                    owner: user.id,
                    kind: kindOf(f.mimeType),
                    name: cleanName(f.name, 100) || "Untitled",
                    folder: null, // папки CRM и Диска не связаны: импортированные файлы лежат в корне раздела
                    driveId: f.id,
                    driveName: f.name,
                    url: f.webViewLink ?? `https://drive.google.com/open?id=${f.id}`,
                    mime: f.mimeType ?? "",
                    modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : new Date(),
                    imported: true,
                    createdByName,
                });
            }
            pageToken = res.nextPageToken;
            if (!pageToken || fresh.length >= IMPORT_LIMIT) break;
        }
        if (fresh.length) await prisma.docItem.createMany({ data: fresh as any });
        return NextResponse.json({ imported: fresh.length, skipped, total });
    } catch (e) {
        // Права уже подключённого Диска старые (без drive.readonly): понятная ошибка вместо «не получилось»
        if (e instanceof DriveScopeError) return NextResponse.json({ message: e.message, code: "drive_scope" }, { status: 409 });
        return failure(e);
    }
}
