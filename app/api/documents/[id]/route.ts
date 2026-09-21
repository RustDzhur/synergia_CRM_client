import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { cleanName, ownedFolder, toDocDTO } from "@/lib/documents";
import { driveParent, driveToken, findDrive } from "@/lib/google";
import { getFile, updateFile } from "@/lib/google/drive";
import { deleteObject } from "@/lib/storage/firebase";
import DocItem from "@/models/DocItem";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const isGoogle = (kind: string) => kind !== "file";

// PATCH /api/documents/:id — { name?, folder?, archived? }. Переименование и перенос отражаются и в Google Drive.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON");
    try {
        await connectDB();
        const doc = await DocItem.findOne({ _id: params.id, owner: user.id });
        if (!doc) return notFound();

        const drive = isGoogle(doc.kind) && doc.driveId ? await findDrive(user.id) : null;
        const token = drive && drive.status === "connected" ? await driveToken(drive) : null;

        if ("name" in body) {
            const name = cleanName(body.name, 100);
            if (!name) return badRequest("Name is required");
            if (token && name !== doc.name) await updateFile(token, doc.driveId, { name });
            doc.name = name;
        }
        if ("folder" in body) {
            const folder = await ownedFolder(user.id, body.folder);
            if (folder === undefined) return badRequest("Folder not found");
            const target = folder ? folder._id : null;
            if (String(target ?? "") !== String(doc.folder ?? "")) {
                if (token && drive) {
                    const current = await getFile(token, doc.driveId);
                    await updateFile(token, doc.driveId, { addParent: await driveParent(token, drive, folder ? String(folder._id) : null), removeParents: current.parents ?? [] });
                }
                doc.folder = target;
            }
        }
        if (typeof body.archived === "boolean") doc.archived = body.archived;
        await doc.save();
        return NextResponse.json(toDocDTO(doc));
    } catch (e) {
        return failure(e);
    }
}

// DELETE /api/documents/:id — Google-документ уходит в корзину на Диске, загруженный файл удаляется из хранилища
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const doc = await DocItem.findOne({ _id: params.id, owner: user.id });
        if (!doc) return notFound();
        if (isGoogle(doc.kind) && doc.driveId) {
            const drive = await findDrive(user.id);
            if (drive && drive.status === "connected") await updateFile(await driveToken(drive), doc.driveId, { trashed: true }).catch(() => undefined);
        } else if (doc.storagePath) {
            await deleteObject(doc.storagePath).catch((e) => console.error("storage delete failed", e));
        }
        await DocItem.deleteOne({ _id: doc._id });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
