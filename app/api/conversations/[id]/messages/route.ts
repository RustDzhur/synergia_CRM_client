import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, notFound, unauthorized, validId } from "@/lib/api";
import { sendToConversation, toMessageDTO } from "@/lib/channels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/conversations/:id/messages — { text }: отправить ответ через канал беседы
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("Text is required");
    if (text.length > 2000) return badRequest("Message is too long");
    try {
        const conversation = await prisma.conversation.findFirst({ where: { id: params.id, owner: user.id } });
        if (!conversation) return notFound();
        const integration = await prisma.integration.findFirst({ where: { id: String(conversation.integration), owner: user.id } });
        if (!integration) return notFound();
        const { message } = await sendToConversation(integration, conversation, text);
        return NextResponse.json(message ? toMessageDTO(message) : null, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
