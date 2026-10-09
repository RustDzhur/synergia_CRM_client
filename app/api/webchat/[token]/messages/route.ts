import { rateLimited } from "@/lib/rateLimit";
import { matchFaq, faqAnswer } from "@/lib/chatbotMatch";
import { priceTokens } from "@/lib/currencyServer";
import { answerVisitor } from "@/lib/ai/publicIris";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import { findByToken } from "@/lib/integrations";
import { recordMessage, toMessageDTO } from "@/lib/channels";
import { corsJson, corsPreflight, validVisitor } from "@/lib/channels/webchat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// GET ?visitor=<id> — переписка посетителя (для опроса виджетом)
export async function GET(req: Request, { params }: { params: { token: string } }) {
    const visitor = new URL(req.url).searchParams.get("visitor");
    if (!validVisitor(visitor)) return corsJson({ message: "Bad visitor" }, 400);
    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const conversation = await prisma.conversation.findFirst({ where: { integration: integration.id, externalId: visitor } });
    if (!conversation) return corsJson({ messages: [] });
    const list = await prisma.message.findMany({ where: { conversation: conversation.id }, orderBy: { createdAt: "desc" }, take: 100 });
    return corsJson({ messages: list.reverse().map(toMessageDTO) });
}

// POST { visitor, text, name? } — сообщение посетителя
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimited(`webchat:${params.token}:${ip}`, 20, 60_000)) return corsJson({ message: "Too many messages" }, 429);

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!validVisitor(body?.visitor) || !text) return corsJson({ message: "Bad request" }, 400);
    if (text.length > 1000) return corsJson({ message: "Message is too long" }, 400);

    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : `Visitor ${body.visitor.slice(-4)}`;
    const lang = typeof body.lang === "string" ? body.lang.slice(0, 2) : "en";
    // страница, с которой пишет посетитель: видно в уведомлении и в переписке — «смотрит цены» помогает ответить по делу
    const page = typeof body.page === "string" ? body.page.slice(0, 300) : "";
    const first = !(await prisma.conversation.findFirst({ where: { integration: integration.id, externalId: body.visitor }, select: { id: true } }));
    const { message } = await recordMessage(integration, { externalId: body.visitor, name, text, ...(page ? { meta: { page } } : {}) });

    // Ответ бота. Основной — Айрис (lib/ai/publicIris.ts): отвечает по базе знаний о платформе, а чего не знает — зовёт человека.
    // Если Айрис недоступна (выключена, суточный лимит, сбой), отвечают прежние готовые тексты по ключевым словам.
    // Бота можно выключить в настройках канала (botEnabled = "0"): тогда сообщение просто ждёт человека.
    // Пока в разговоре недавно отвечал человек, бот молчит — оператора он перебивать не должен.
    const botOn = (integration.config as any)?.botEnabled !== "0";
    let reply: ReturnType<typeof toMessageDTO> | null = null;
    let answered = false;
    const botSay = async (text: string, ai: boolean) => {
        const { message: botMessage } = await recordMessage(integration, { externalId: body.visitor, name: "Bot", direction: "out", meta: { bot: 1, ...(ai ? { ai: 1 } : {}) }, text });
        return botMessage ? toMessageDTO(botMessage) : null;
    };
    if (botOn && message) {
        const convo = await prisma.conversation.findFirst({ where: { integration: integration.id, externalId: body.visitor }, select: { id: true } });
        const recent = convo ? await prisma.message.findMany({ where: { conversation: convo.id }, orderBy: { createdAt: "desc" }, take: 12 }) : [];
        const humanActive = recent.some((m) => m.direction === "out" && !(m.meta as { bot?: number } | null)?.bot && Date.now() - new Date(m.createdAt).getTime() < 30 * 60_000);
        if (humanActive) {
            answered = true; // с посетителем уже говорит человек
        } else {
            const history = recent.reverse().map((m) => ({ role: (m.direction === "in" ? "user" : "assistant") as "user" | "assistant", text: String(m.text ?? "") }));
            if (history[history.length - 1]?.role !== "user" || history[history.length - 1]?.text !== text) history.push({ role: "user", text }); // вопрос всегда последний
            const ai = await answerVisitor({ history, lang, page });
            if (ai && !ai.handoff) { reply = await botSay(ai.text, true); answered = true; }
            else if (ai && ai.handoff) { await botSay(ai.text, true); /* ответ человеку: reply остаётся пустым — виджет предложит оставить контакт */ }
            else {
                const hit = matchFaq(text);
                // цены в готовом ответе — по курсу языка посетителя, как на странице тарифов
                if (hit) { reply = await botSay(faqAnswer(hit, lang, await priceTokens(lang)), false); answered = true; }
            }
        }
    }

    if (first || !answered) {
        void notifyTeamTelegram(String(integration.owner),
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
