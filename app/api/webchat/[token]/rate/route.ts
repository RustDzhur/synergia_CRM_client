import { connectDB } from "@/lib/mongodb";
import { rateLimited } from "@/lib/rateLimit";
import { findByToken } from "@/lib/integrations";
import { corsJson, corsPreflight, validVisitor } from "@/lib/channels/webchat";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// POST { visitor, messageId, rating: "up" | "down" } — оценка ответа бота. Нужна не ради красивых цифр:
// по ней видно, каких тем не хватает в базе знаний (app/content/chatbotFaq.ts), поэтому «не помогло»
// уходит команде в Telegram вместе с самим вопросом.
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimited(`webchat-rate:${params.token}:${ip}`, 20, 60_000)) return corsJson({ message: "Too many requests" }, 429);

    const body = await req.json().catch(() => null);
    const rating = body?.rating === "up" ? "up" : body?.rating === "down" ? "down" : "";
    if (!validVisitor(body?.visitor) || !rating || typeof body?.messageId !== "string") return corsJson({ message: "Bad request" }, 400);

    await connectDB();
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const conversation = await Conversation.findOne({ integration: integration._id, externalId: body.visitor });
    if (!conversation) return corsJson({ message: "Not found" }, 404);

    // оценивают ответ бота, а не человека: ищем именно такое сообщение в этой беседе
    const message = await Message.findOneAndUpdate(
        { _id: body.messageId, conversation: conversation._id, direction: "out", "meta.bot": 1 },
        { $set: { "meta.rating": rating } },
        { new: true }
    );
    if (!message) return corsJson({ message: "Not found" }, 404);

    if (rating === "down") {
        // вопрос, на который бот ответил плохо: без него непонятно, какую тему дописывать
        const question = await Message.findOne({ conversation: conversation._id, direction: "in", createdAt: { $lt: message.createdAt } }).sort({ createdAt: -1 });
        void notifyTeamTelegram(
            [
                "👎 Ответ бота не помог посетителю",
                `Вопрос: ${String(question?.text ?? "").slice(0, 200)}`,
                `Ответ: ${String(message.text ?? "").slice(0, 200)}`,
                "Стоит дополнить базу знаний или ответить человеку.",
            ].join("\n")
        );
    }
    return corsJson({ ok: true });
}
