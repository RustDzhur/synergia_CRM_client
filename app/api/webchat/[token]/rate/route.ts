import { rateLimited } from "@/lib/rateLimit";
import { findByToken } from "@/lib/integrations";
import { corsJson, corsPreflight, validVisitor } from "@/lib/channels/webchat";
import { notifyTeamTelegram } from "@/lib/notifyTeam";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const OPTIONS = corsPreflight;

// POST { visitor, messageId, rating: "up" | "down" } — оценка ответа бота.
export async function POST(req: Request, { params }: { params: { token: string } }) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimited(`webchat-rate:${params.token}:${ip}`, 20, 60_000)) return corsJson({ message: "Too many requests" }, 429);

    const body = await req.json().catch(() => null);
    const rating = body?.rating === "up" ? "up" : body?.rating === "down" ? "down" : "";
    if (!validVisitor(body?.visitor) || !rating || typeof body?.messageId !== "string") return corsJson({ message: "Bad request" }, 400);

    const integration = await findByToken("webchat", params.token);
    if (!integration) return corsJson({ message: "Not found" }, 404);
    const conversation = await prisma.conversation.findFirst({ where: { integration: integration.id, externalId: body.visitor } });
    if (!conversation) return corsJson({ message: "Not found" }, 404);

    // оценивают ответ бота, а не человека: ищем именно такое сообщение в этой беседе
    const found = await prisma.message.findFirst({ where: { id: body.messageId, conversation: conversation.id, direction: "out", meta: { path: ["bot"], equals: 1 } } });
    if (!found) return corsJson({ message: "Not found" }, 404);
    const message = await prisma.message.update({ where: { id: found.id }, data: { meta: { ...((found.meta as any) ?? {}), rating } as any } });

    if (rating === "down") {
        // вопрос, на который бот ответил плохо: без него непонятно, какую тему дописывать
        const question = await prisma.message.findFirst({ where: { conversation: conversation.id, direction: "in", createdAt: { lt: message.createdAt } }, orderBy: { createdAt: "desc" } });
        void notifyTeamTelegram(String(integration.owner),
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
