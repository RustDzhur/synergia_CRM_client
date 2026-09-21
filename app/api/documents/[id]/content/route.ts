import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, notFound, unauthorized, validId } from "@/lib/api";
import { getObject } from "@/lib/storage/firebase";
import DocItem from "@/models/DocItem";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Показывать прямо в браузере разрешаем только безопасные форматы; остальное (в том числе SVG и HTML) — только скачиванием
const INLINE = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"]);

// GET /api/documents/:id/content — содержимое загруженного файла из хранилища (только владельцу)
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    if (!validId(params.id)) return notFound();
    try {
        await connectDB();
        const doc = await DocItem.findOne({ _id: params.id, owner: user.id, kind: "file" });
        if (!doc || !doc.storagePath) return notFound();
        const res = await getObject(doc.storagePath);
        if (!res) return notFound();
        const inline = INLINE.has(doc.mime);
        return new Response(res.body, {
            headers: {
                "Content-Type": inline ? doc.mime : "application/octet-stream",
                "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
                "Cache-Control": "private, max-age=60",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
