import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { ProviderError } from "@/lib/http";
import { cleanName, docsState, ownedFolder, toDocDTO } from "@/lib/documents";
import { driveParent, driveToken, findDrive } from "@/lib/google";
import { createGoogleFile, listAppFiles } from "@/lib/google/drive";
import DocItem from "@/models/DocItem";
import DocFolder from "@/models/DocFolder";
import User from "@/models/User";

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
    const items = await DocItem.find({ owner, kind: { $in: ["gdoc", "gsheet", "gslide"] }, driveId: { $ne: "" } });
    for (const it of items) {
        if (trashedIds.has(it.driveId)) {
            await DocItem.deleteOne({ _id: it._id });
            continue;
        }
        const f = liveById.get(it.driveId);
        if (!f) continue;
        const at = f.modifiedTime ? new Date(f.modifiedTime) : undefined;
        if (f.name !== it.name || (at && at.getTime() !== it.modifiedAt?.getTime())) {
            it.name = f.name;
            if (at) it.modifiedAt = at;
            await it.save();
        }
    }
}

// GET /api/documents[?refresh=1] — папки, документы, состояние Google Drive и файлового хранилища
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    try {
        await connectDB();
        if (new URL(req.url).searchParams.get("refresh") === "1") await syncFromDrive(user.id).catch(() => undefined);
        return NextResponse.json(await docsState(user.id));
    } catch (e) {
        return failure(e);
    }
}

// POST /api/documents — { kind: "gdoc" | "gsheet" | "gslide", name, folder? }: создаёт Google-документ на Диске пользователя в папке CRM
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    const body = await req.json().catch(() => null);
    const kind = body?.kind;
    const name = cleanName(body?.name, 100);
    if (!["gdoc", "gsheet", "gslide"].includes(kind) || !name) return badRequest("Invalid document");
    try {
        await connectDB();
        const folder = await ownedFolder(user.id, body?.folder);
        if (folder === undefined) return badRequest("Folder not found");
        const drive = await findDrive(user.id);
        if (!drive || drive.status !== "connected") return NextResponse.json({ message: "Connect Google Drive first" }, { status: 409 });
        const token = await driveToken(drive);

        const create = async () => createGoogleFile(token, kind, name, await driveParent(token, drive, folder ? String(folder._id) : null));
        let file;
        try {
            file = await create();
        } catch (e) {
            // папку на Диске могли удалить вручную — забываем её идентификатор и создаём заново
            if (!(e instanceof ProviderError) || !/not found|File not found/i.test(e.message)) throw e;
            if (folder) await DocFolder.updateOne({ _id: folder._id }, { driveId: "" });
            else { drive.set("config", { ...drive.config, rootFolderId: "" }); drive.markModified("config"); await drive.save(); }
            file = await create();
        }
        const me = await User.findById(user.id).select("firstname lastname");
        const doc = await DocItem.create({
            owner: user.id,
            kind,
            name,
            folder: folder ? folder._id : null,
            driveId: file.id,
            url: file.webViewLink ?? `https://drive.google.com/open?id=${file.id}`,
            modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
            createdByName: me ? `${me.firstname} ${me.lastname}` : "",
        });
        return NextResponse.json(toDocDTO(doc), { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
