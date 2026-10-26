import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { toConversationDTO } from "@/lib/channels";
import { appOrigin } from "@/lib/appUrl";
import { healWebhooks } from "@/lib/channels/connect";
import { pullAllTelegram } from "@/lib/channels/telegramPoll";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/conversations — беседы всех подключённых каналов, свежие сверху
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await healWebhooks(user.id, appOrigin(req)).catch(() => undefined);
    await pullAllTelegram(user.id); // Telegram в режиме без вебхука: подтягиваем новые сообщения
    const list = await prisma.conversation.findMany({ where: { owner: user.id }, orderBy: { lastAt: "desc" }, take: 200 });
    // Контакты бесед — одним запросом, чтобы у каждой карточка была сразу в списке (без N+1)
    const ids = Array.from(new Set(list.map((c) => (c.contact ? String(c.contact) : "")).filter(Boolean)));
    const contacts = ids.length
        ? await prisma.contact.findMany({ where: { owner: user.id, id: { in: ids } }, select: { id: true, name: true, avatar: true, channel: true, firstContactAt: true } })
        : [];
    const byId = new Map(contacts.map((c) => [c.id, c]));
    return NextResponse.json(list.map((c) => toConversationDTO(c, c.contact ? byId.get(String(c.contact)) ?? null : null)));
}
