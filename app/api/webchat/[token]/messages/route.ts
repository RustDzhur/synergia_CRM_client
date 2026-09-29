import { connectDB } from "@/lib/mongodb";
import { rateLimited } from "@/lib/rateLimit";
import { tx } from "@/content/i18n";
import { matchFaq } from "@/lib/chatbotMatch";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import { findByToken } from "@/lib/integrations";
import { recordMessage, toMessageDTO } from "@/lib/channels";
import { corsJson, corsPreflight, validVisitor } from "@/lib/channels/webchat";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// GET ?visitor=<id> — переписка посетителя (для опроса виджетом)
export async function GET(req: Request, { params }: { params: { token: string } }) {
    const visitor = new URL(req.url).searchParams.get("visitor");
    if (!validVisitor(visitor)) return corsJson({ message: "Bad visitor" }, 400);
    await connectDB();
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const conversation = await Conversation.findOne({ integration: integration._id, externalId: visitor });
    if (!conversation) return corsJson({ messages: [] });
    const list = (await Message.find({ conversation: conversation._id }).sort({ createdAt: -1 }).limit(100)).reverse();
    return corsJson({ messages: list.map(toMessageDTO) });
}

// POST { visitor, text, name? } — сообщение посетителя
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimited(`webchat:${params.token}:${ip}`, 20, 60_000)) return corsJson({ message: "Too many messages" }, 429);

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!validVisitor(body?.visitor) || !text) return corsJson({ message: "Bad request" }, 400);
    if (text.length > 1000) return corsJson({ message: "Message is too long" }, 400);

    await connectDB();
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : `Visitor ${body.visitor.slice(-4)}`;
    const lang = typeof body.lang === "string" ? body.lang.slice(0, 2) : "en";
    // страница, с которой пишет посетитель: видно в уведомлении и в переписке — «смотрит цены» помогает ответить по делу
    const page = typeof body.page === "string" ? body.page.slice(0, 300) : "";
    const first = !(await Conversation.exists({ integration: integration._id, externalId: body.visitor }));
    const { message } = await recordMessage(integration, { externalId: body.visitor, name, text, ...(page ? { meta: { page } } : {}) });

    // Готовый ответ бота: те же тексты, что были в чатботе на лендинге (app/content/chatbotFaq.ts).
    // Ответ записываем в переписку, чтобы человек в CRM видел, что посетителю уже сказали, — и отвечаем сразу.
    // Бота можно выключить в настройках канала: тогда сообщение просто ждёт человека
    const hit = integration.config.botEnabled === "0" ? null : matchFaq(text);
    let reply: ReturnType<typeof toMessageDTO> | null = null;
    if (hit) {
        const { message: botMessage } = await recordMessage(integration, {
            externalId: body.visitor,
            name: "Bot",
            direction: "out",
            meta: { bot: 1 },
            text: tx(hit.a, lang),
        });
        if (botMessage) reply = toMessageDTO(botMessage);
    }

    // Команде — в Telegram (в CRM уведомление создаётся само, при записи сообщения). Пишем в двух случаях:
    // первое сообщение посетителя и вопрос, на который у бота нет ответа, — то есть когда нужен человек
    if (first || !hit) {
        void notifyTeamTelegram(
            [
                first ? "💬 Новое обращение в чат на сайте" : "💬 Вопрос без готового ответа (нужен человек)",
                `От: ${name}`,
                page ? `Страница: ${page}` : "",
                `Вопрос: ${text}`,
            ]
                .filter(Boolean)
                .join("\n")
        );
    }
    return corsJson({ message: message ? toMessageDTO(message) : null, reply }, 201);
}
