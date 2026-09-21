import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { cleanName, descendantIds, ownedFolder, toFolderDTO } from "@/lib/documents";
import { driveParent, driveToken, findDrive } from "@/lib/google";
import { getFile, updateFile } from "@/lib/google/drive";
import DocFolder from "@/models/DocFolder";
import DocItem from "@/models/DocItem";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// PATCH /api/documents/folders/:id — { name?, parent? }. Переименование и перенос в Google Drive — по возможности (ошибка Drive не мешает).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return badRequest("Invalid JSON");
    try {
        await connectDB();
        const folder = await DocFolder.findOne({ _id: params.id, owner: user.id });
        if (!folder) return notFound();
        const drive = folder.driveId ? await findDrive(user.id) : null;
        const token = drive && drive.status === "connected" ? await driveToken(drive).catch(() => null) : null;

        if ("name" in body) {
            const name = cleanName(body.name, 80);
            if (!name) return badRequest("Folder name is required");
            const clash = await DocFolder.exists({ owner: user.id, parent: folder.parent, name, _id: { $ne: folder._id } });
            if (clash) return NextResponse.json({ message: "A folder with this name already exists" }, { status: 409 });
            if (name !== folder.name && token) await updateFile(token, folder.driveId, { name }).catch(() => undefined);
            folder.name = name;
        }
        if ("parent" in body) {
            const parent = await ownedFolder(user.id, body.parent);
            if (parent === undefined) return badRequest("Folder not found");
            const parentId = parent ? String(parent._id) : null;
            if (parentId && (parentId === String(folder._id) || (await descendantIds(user.id, String(folder._id))).has(parentId))) {
                return badRequest("A folder cannot be moved into itself");
            }
            if (parentId !== (folder.parent ? String(folder.parent) : null)) {
                if (token && drive) {
                    try {
                        const current = await getFile(token, folder.driveId);
                        await updateFile(token, folder.driveId, { addParent: await driveParent(token, drive, parentId), removeParents: current.parents ?? [] });
                    } catch { /* зеркало в Drive может разойтись — в CRM папка всё равно перенесена */ }
                }
                folder.parent = parent ? parent._id : null;
            }
        }
        await folder.save();
        return NextResponse.json(toFolderDTO(folder));
    } catch (e) {
        return failure(e);
    }
}

// DELETE /api/documents/folders/:id — только пустую папку
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const folder = await DocFolder.findOne({ _id: params.id, owner: user.id });
        if (!folder) return notFound();
        const busy = (await DocFolder.exists({ owner: user.id, parent: folder._id })) || (await DocItem.exists({ owner: user.id, folder: folder._id }));
        if (busy) return NextResponse.json({ message: "The folder is not empty. Move or delete its contents first." }, { status: 409 });
        if (folder.driveId) {
            const drive = await findDrive(user.id);
            if (drive && drive.status === "connected") await updateFile(await driveToken(drive), folder.driveId, { trashed: true }).catch(() => undefined);
        }
        await DocFolder.deleteOne({ _id: folder._id });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
