import { connectDB } from "@/lib/mongodb";
import { rateLimited } from "@/lib/rateLimit";
import { findByToken } from "@/lib/integrations";
import { corsJson, corsPreflight, validVisitor } from "@/lib/channels/webchat";
import { type MediaKind, mediaLabel, saveMedia } from "@/lib/channels/media";
import { recordMessage, toMessageDTO } from "@/lib/channels";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import Conversation from "@/models/Conversation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const OPTIONS = corsPreflight;

// Какие типы принимаем: картинки, документы, звук и видео. Всё остальное (архивы, исполняемые файлы)
// отбрасываем — публичный адрес, куда можно залить что угодно, нам не нужен.
const ALLOWED = /^(image|audio|video|text)\/|^application\/(pdf|msword|vnd\.|zip|json|octet-stream)/i;

// POST (multipart: visitor, file) — посетитель прикладывает файл. Кладём его в хранилище фирмы и пишем
// сообщением с вложением: агент увидит его в переписке так же, как вложения из мессенджеров.
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimited(`webchat-upload:${params.token}:${ip}`, 5, 60_000)) return corsJson({ message: "Too many files" }, 429);

    const form = await req.formData().catch(() => null);
    const visitor = form?.get("visitor");
    const file = form?.get("file");
    if (!validVisitor(visitor) || !(file instanceof File)) return corsJson({ message: "Bad request" }, 400);
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED.test(mime)) return corsJson({ message: "This file type is not accepted" }, 415);
    // Предел тела запроса у функций Vercel — 4,5 МБ, поэтому проверяем размер сами: иначе отказ пришёл бы
    // без понятного текста
    if (file.size > 4 * 1024 * 1024) return corsJson({ message: "The file is too large (max 4 MB)" }, 413);

    await connectDB();
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const owner = String(integration.owner);

    const kind: MediaKind = mime.startsWith("image/") ? "image" : mime.startsWith("audio/") ? "voice" : "file";
    const saved = await saveMedia(owner, { kind, name: file.name || "file", mime }, Buffer.from(await file.arrayBuffer()));
    if (!saved) return corsJson({ message: "The file could not be stored" }, 400);

    const conversation = await Conversation.findOne({ integration: integration._id, externalId: visitor });
    const name = conversation?.name || `Visitor ${String(visitor).slice(-4)}`;
    const { message } = await recordMessage(integration, { externalId: String(visitor), name, text: "", attachment: saved });
    void notifyTeamTelegram(["📎 Посетитель прислал файл в чате на сайте", `От: ${name}`, `Файл: ${saved.name}`, `Вид: ${mediaLabel(saved) || "файл"}`].join("\n"));
    return corsJson({ message: message ? toMessageDTO(message) : null }, 201);
}
