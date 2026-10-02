import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { getObject } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

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
        const message = await prisma.message.findFirst({ where: { id: params.id, owner: user.id } });
        // вложение — Json-поле записи: приводим к объекту один раз
        const attachment = (message?.attachment ?? null) as any;
        if (!attachment?.path) return notFound();
        const res = await getObject(attachment.path);
        if (!res) return notFound();
        const mime = attachment.mime || "application/octet-stream";
        const shown = inline(mime);
        return new Response(res.body, {
            headers: {
                "Content-Type": shown ? mime : "application/octet-stream",
                "Content-Disposition": `${shown ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
                "Cache-Control": "private, max-age=60",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
