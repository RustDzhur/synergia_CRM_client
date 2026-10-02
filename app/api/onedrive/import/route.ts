import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { cleanName } from "@/lib/documents";
import { findOnedrive, onedriveItem, onedriveToken } from "@/lib/onedrive";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IDS = 100;

// POST /api/onedrive/import — { ids: string[] }: завести в CRM записи о выбранных файлах OneDrive.
// Файлы остаются в OneDrive (как и перенесённые с Google Диска): в CRM хранится ссылка и метаданные,
// а не копия. Повторный выбор того же файла ничего не дублирует — запись ищется по driveId.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown): v is string => typeof v === "string" && v.length > 0).slice(0, MAX_IDS) : [];
    if (!ids.length) return badRequest("Choose at least one file");
    try {
        const drive = await findOnedrive(user.id);
        if (!drive || drive.status !== "connected") return NextResponse.json({ message: "Connect OneDrive first", code: "not_connected" }, { status: 409 });
        const token = await onedriveToken(drive);

        const known = new Set<string>(
            (await prisma.docItem.findMany({ where: { owner: user.id, cloud: "onedrive", driveId: { in: ids } }, select: { driveId: true } })).map((d) => String(d.driveId ?? ""))
        );
        const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const createdByName = me ? `${me.firstname} ${me.lastname}` : "";

        let imported = 0;
        let skipped = 0;
        for (const id of ids) {
            if (known.has(id)) { skipped += 1; continue; }
            const item = await onedriveItem(token, id);
            if (!item || item.folder) { skipped += 1; continue; }
            await prisma.docItem.create({
                data: {
                    owner: user.id,
                    kind: "file",
                    name: cleanName(item.name, 100) || "Untitled",
                    folder: null, // папки CRM и OneDrive не связаны: перенесённые файлы лежат в корне раздела
                    cloud: "onedrive",
                    driveId: item.id,
                    driveName: item.name,
                    url: item.url,
                    mime: item.mime,
                    size: item.size,
                    modifiedAt: item.modified ? new Date(item.modified) : new Date(),
                    imported: true,
                    createdByName,
                },
            });
            known.add(id);
            imported += 1;
        }
        return NextResponse.json({ imported, skipped }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
