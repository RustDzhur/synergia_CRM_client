import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { ProviderError } from "@/lib/http";
import { cleanName, docsState, ownedFolder, toDocDTO } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { driveParent, driveToken, findDrive } from "@/lib/google";
import { createGoogleFile, listAppFiles } from "@/lib/google/drive";


export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Подтягивает из Google Drive новые имена и даты изменения документов; документы, удалённые в корзину на Диске, убирает из CRM
async function syncFromDrive(owner: string) {
    const drive = await findDrive(owner);
    if (!drive || drive.status !== "connected") return;
    const token = await driveToken(drive);
    const [live, trashed] = await Promise.all([listAppFiles(token, false), listAppFiles(token, true)]);
    const liveById = new Map(live.map((f) => [f.id, f]));
    const trashedIds = new Set(trashed.map((f) => f.id));
    // Все документы с идентификатором на Диске: Google-документы, созданные CRM, и файлы, импортированные с Диска
    const items = await prisma.docItem.findMany({ where: { owner, driveId: { not: "" } } });
    for (const it of items) {
        if (trashedIds.has(it.driveId)) {
            await prisma.docItem.deleteMany({ where: { id: it.id } });
            continue;
        }
        const f = liveById.get(it.driveId);
        if (!f) continue;
        const at = f.modifiedTime ? new Date(f.modifiedTime) : undefined;
        // Имя меняем вслед за Диском, только если его изменили там: переименование в CRM (у импортированных
        // файлов оно остаётся в CRM — на Диске приложение их не правит) не должно затираться.
        const renamedOnDrive = f.name !== (it.driveName || it.name);
        if (renamedOnDrive || (at && at.getTime() !== it.modifiedAt?.getTime())) {
            await prisma.docItem.update({
                where: { id: it.id },
                data: { ...(renamedOnDrive ? { name: f.name, driveName: f.name } : {}), ...(at ? { modifiedAt: at } : {}) },
            });
        }
    }
}

// GET /api/documents[?refresh=1] — папки, документы, состояние Google Drive и файлового хранилища
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        if (new URL(req.url).searchParams.get("refresh") === "1") await syncFromDrive(user.id).catch(() => undefined);
        return NextResponse.json(await docsState(user.id));
    } catch (e) {
        return failure(e);
    }
}

// POST /api/documents — { kind: "gdoc" | "gsheet" | "gslide", name, folder? }: создаёт Google-документ на Диске пользователя в папке CRM
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const body = await req.json().catch(() => null);
    const kind = body?.kind;
    const name = cleanName(body?.name, 100);
    if (!["gdoc", "gsheet", "gslide"].includes(kind) || !name) return badRequest("Invalid document");
    try {
        const folder = await ownedFolder(user.id, body?.folder);
        if (folder === undefined) return badRequest("Folder not found");
        const drive = await findDrive(user.id);
        if (!drive || drive.status !== "connected") return NextResponse.json({ message: "Connect Google Drive first" }, { status: 409 });
        const token = await driveToken(drive);

        const create = async () => createGoogleFile(token, kind, name, await driveParent(token, drive, folder ? folder.id : null));
        let file;
        try {
            file = await create();
        } catch (e) {
            // папку на Диске могли удалить вручную — забываем её идентификатор и создаём заново
            if (!(e instanceof ProviderError) || !/not found|File not found/i.test(e.message)) throw e;
            if (folder) await prisma.docFolder.updateMany({ where: { id: folder.id }, data: { driveId: "" } });
            else { await prisma.integration.update({ where: { id: drive.id }, data: { config: { ...((drive.config ?? {}) as any), rootFolderId: "" } as any } }); }
            file = await create();
        }
        const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const doc = await prisma.docItem.create({
            data: {
            owner: user.id,
            kind,
            name,
            folder: folder ? folder.id : null,
            driveId: file.id,
            url: file.webViewLink ?? `https://drive.google.com/open?id=${file.id}`,
            modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
            createdByName: me ? `${me.firstname} ${me.lastname}` : "",
            },
        });
        return NextResponse.json(toDocDTO(doc), { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
