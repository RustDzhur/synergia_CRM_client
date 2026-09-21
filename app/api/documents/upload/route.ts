import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, QUOTA_BYTES, ownedFolder, safeFileName, toDocDTO } from "@/lib/documents";
import { putObject, storageConfigured } from "@/lib/storage/firebase";
import DocItem from "@/models/DocItem";
import User from "@/models/User";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Исполняемые файлы и скрипты не принимаем
const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|vbs|ps1|sh|jar|dll|apk|app)$/i;

// POST /api/documents/upload — multipart: file, folder? — загрузка файла или фото в Firebase Storage
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!storageConfigured()) return NextResponse.json({ message: "File storage is not configured yet" }, { status: 503 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) return badRequest("Choose a file to upload");
    if (file.size === 0) return badRequest("The file is empty");
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: `The file is larger than ${MAX_UPLOAD_MB} MB` }, { status: 413 });
    const name = safeFileName(file.name);
    if (BLOCKED.test(name)) return badRequest("This file type is not allowed");
    try {
        await connectDB();
        const folder = await ownedFolder(user.id, form.get("folder") || null);
        if (folder === undefined) return badRequest("Folder not found");
        const used = await DocItem.aggregate([{ $match: { owner: new Types.ObjectId(user.id), kind: "file" } }, { $group: { _id: null, total: { $sum: "$size" } } }]);
        if ((used[0]?.total ?? 0) + file.size > QUOTA_BYTES) return NextResponse.json({ message: "Your file storage is full" }, { status: 413 });

        const me = await User.findById(user.id).select("firstname lastname");
        const doc = await DocItem.create({
            owner: user.id,
            kind: "file",
            name,
            folder: folder ? folder._id : null,
            mime: (file.type || "application/octet-stream").toLowerCase(),
            size: file.size,
            createdByName: me ? `${me.firstname} ${me.lastname}` : "",
        });
        doc.storagePath = `users/${user.id}/${doc._id}/${name}`;
        try {
            await putObject(doc.storagePath, Buffer.from(await file.arrayBuffer()), doc.mime);
        } catch (e) {
            await DocItem.deleteOne({ _id: doc._id });
            throw e;
        }
        await doc.save();
        return NextResponse.json(toDocDTO(doc), { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
