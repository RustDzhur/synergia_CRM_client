import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, ownedFolder, quotaBytes, safeFileName, toDocDTO } from "@/lib/documents";
import { putObject, storageConfigured } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Исполняемые файлы и скрипты не принимаем
const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|vbs|ps1|sh|jar|dll|apk|app)$/i;

// POST /api/documents/upload — multipart: file, folder? — загрузка файла или фото в Firebase Storage
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!storageConfigured()) return NextResponse.json({ message: "File storage is not configured yet" }, { status: 503 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) return badRequest("Choose a file to upload");
    if (file.size === 0) return badRequest("The file is empty");
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ message: `The file is larger than ${MAX_UPLOAD_MB} MB` }, { status: 413 });
    const name = safeFileName(file.name);
    if (BLOCKED.test(name)) return badRequest("This file type is not allowed");
    try {
        const folder = await ownedFolder(user.id, form.get("folder") || null);
        if (folder === undefined) return badRequest("Folder not found");
        // Занятое считаем только по файлам, которые лежат у нас: строки, ссылающиеся на Google
        // (документы Google и перенесённые с Диска), места в тарифе не занимают
        // Занятое считаем только по файлам, которые лежат у нас: строки со ссылкой на Google
        // (документы Google и перенесённые с Диска) места в тарифе не занимают
        const [used, quota] = await Promise.all([
            prisma.docItem.aggregate({ where: { owner: user.id, kind: "file", driveId: "" }, _sum: { size: true } }),
            quotaBytes(user.id),
        ]);
        if ((used._sum.size ?? 0) + file.size > quota) return NextResponse.json({ message: "Your file storage is full. Upgrade the plan for more space.", code: "plan_limit" }, { status: 413 });

        const me = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const doc = await prisma.docItem.create({
            data: {
                owner: user.id,
                kind: "file",
                name,
                folder: folder ? folder.id : null,
                mime: (file.type || "application/octet-stream").toLowerCase(),
                size: file.size,
                createdByName: me ? `${me.firstname} ${me.lastname}` : "",
            },
        });
        const storagePath = `users/${user.id}/${doc.id}/${name}`;
        try {
            await putObject(storagePath, Buffer.from(await file.arrayBuffer()), doc.mime);
        } catch (e) {
            await prisma.docItem.deleteMany({ where: { id: doc.id } });
            throw e;
        }
        const saved = await prisma.docItem.update({ where: { id: doc.id }, data: { storagePath } });
        return NextResponse.json(toDocDTO(saved), { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
