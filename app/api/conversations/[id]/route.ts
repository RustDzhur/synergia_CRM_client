import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { toConversationDTO, toMessageDTO } from "@/lib/channels";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

export const dynamic = "force-dynamic";

// GET /api/conversations/:id?read=1 — переписка (последние 200); read=1 сбрасывает счётчик непрочитанных
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const conversation = await Conversation.findOne({ _id: params.id, owner: user.id });
    if (!conversation) return notFound();
    if (new URL(req.url).searchParams.get("read") === "1" && conversation.unread > 0) {
        conversation.unread = 0;
        await conversation.save();
    }
    const messages = (await Message.find({ conversation: conversation._id }).sort({ createdAt: -1 }).limit(200)).reverse();
    return NextResponse.json({ conversation: toConversationDTO(conversation), messages: messages.map(toMessageDTO) });
}

// DELETE /api/conversations/:id — удалить беседу вместе с сообщениями
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const conversation = await Conversation.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!conversation) return notFound();
    await Message.deleteMany({ conversation: conversation._id });
    return NextResponse.json({ ok: true });
}
