import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { appOrigin } from "@/lib/appUrl";
import { sendToConversation, toMessageDTO } from "@/lib/channels";
import { MAX_ATTACH_BYTES, MAX_ATTACH_MB, dropMedia, mediaKind, mediaName, saveMedia } from "@/lib/channels/media";
import Conversation from "@/models/Conversation";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Исполняемые файлы и скрипты не принимаем (как и в документах)
const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|vbs|ps1|sh|jar|dll|apk|app)$/i;

// POST /api/conversations/:id/attachment — multipart: file, text? — отправить фото, файл или голосовое
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) return badRequest("Choose a file to send");
    if (file.size === 0) return badRequest("The file is empty");
    if (file.size > MAX_ATTACH_BYTES) return NextResponse.json({ message: `The file is larger than ${MAX_ATTACH_MB} MB`, code: "too_large" }, { status: 413 });
    const name = mediaName(file.name, "file");
    if (BLOCKED.test(name)) return badRequest("This file type is not allowed");
    const text = typeof form.get("text") === "string" ? (form.get("text") as string).trim().slice(0, 2000) : "";
    try {
        await connectDB();
        const conversation = await Conversation.findOne({ _id: params.id, owner: user.id });
        if (!conversation) return notFound();
        const integration = await Integration.findOne({ _id: conversation.integration, owner: user.id });
        if (!integration) return notFound();
        const data = Buffer.from(await file.arrayBuffer());
        const mime = (file.type || "application/octet-stream").toLowerCase();
        const attachment = await saveMedia(user.id, { kind: mediaKind(mime, name), name, mime }, data);
        if (!attachment) return NextResponse.json({ message: "File storage is not configured yet" }, { status: 503 });
        // провайдер отправляет — и только потом сообщение попадает в беседу; иначе файл в хранилище не нужен
        let message;
        try {
            ({ message } = await sendToConversation(integration, conversation, text, { attachment, data, origin: appOrigin(req) }));
        } catch (e) {
            await dropMedia(attachment.path);
            throw e;
        }
        return NextResponse.json(message ? toMessageDTO(message) : null, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
