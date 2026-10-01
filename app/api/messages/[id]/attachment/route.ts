import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { getObject } from "@/lib/storage";
import Message from "@/models/Message";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Показывать прямо в браузере разрешаем картинки, звук, видео и PDF; остальное — только скачиванием
const inline = (mime: string) => /^(image\/(jpeg|png|gif|webp|heic)|audio\/|video\/|application\/pdf)/.test(mime);

// GET /api/messages/:id/attachment — вложение сообщения (только его владельцу)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const message = await Message.findOne({ _id: params.id, owner: user.id });
        if (!message?.attachment?.path) return notFound();
        const res = await getObject(message.attachment.path);
        if (!res) return notFound();
        const mime = message.attachment.mime || "application/octet-stream";
        const shown = inline(mime);
        return new Response(res.body, {
            headers: {
                "Content-Type": shown ? mime : "application/octet-stream",
                "Content-Disposition": `${shown ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(message.attachment.name)}`,
                "Cache-Control": "private, max-age=60",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
