import { failure } from "@/lib/api";
import { mimeByName, readMediaToken } from "@/lib/channels/media";
import { getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/media/:token — файл беседы по подписанной ссылке. Нужен провайдерам, которые принимают вложение
// только ссылкой (Viber): ссылку подписывает сервер, живёт она час и открывает ровно один файл.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
    const path = readMediaToken(params.token);
    if (!path) return new Response("Forbidden", { status: 403 });
    try {
            const res = await getObject(path);
        if (!res) return new Response("Not found", { status: 404 });
        const mime = mimeByName(path);
        return new Response(res.body, {
            headers: {
                "Content-Type": mime,
                "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(path.split("/").pop() ?? "file")}`,
                "Cache-Control": "private, max-age=300",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (e) {
        return failure(e);
    }
}
