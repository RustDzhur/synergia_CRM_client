import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { toConversationDTO, toMessageDTO } from "@/lib/channels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/conversations/:id?read=1 — переписка (последние 200); read=1 сбрасывает счётчик непрочитанных
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    let conversation = await prisma.conversation.findFirst({ where: { id: params.id, owner: user.id } });
    if (!conversation) return notFound();
    if (new URL(req.url).searchParams.get("read") === "1" && conversation.unread > 0) {
        conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: { unread: 0 } });
    }
    const messages = (await prisma.message.findMany({ where: { conversation: conversation.id }, orderBy: { createdAt: "desc" }, take: 200 })).reverse();
    return NextResponse.json({ conversation: toConversationDTO(conversation), messages: messages.map(toMessageDTO) });
}

// DELETE /api/conversations/:id — удалить беседу вместе с сообщениями
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const conversation = await prisma.conversation.findFirst({ where: { id: params.id, owner: user.id } });
    if (!conversation) return notFound();
    await prisma.message.deleteMany({ where: { conversation: conversation.id } });
    await prisma.conversation.deleteMany({ where: { id: conversation.id } });
    return NextResponse.json({ ok: true });
}
