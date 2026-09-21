import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { toConversationDTO } from "@/lib/channels";
import { appOrigin } from "@/lib/appUrl";
import { healWebhooks } from "@/lib/channels/connect";
import { pullAllTelegram } from "@/lib/channels/telegramPoll";
import Conversation from "@/models/Conversation";

export const dynamic = "force-dynamic";

// GET /api/conversations — беседы всех подключённых каналов, свежие сверху
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    await healWebhooks(user.id, appOrigin(req)).catch(() => undefined);
    await pullAllTelegram(user.id); // Telegram в режиме без вебхука: подтягиваем новые сообщения
    const list = await Conversation.find({ owner: user.id }).sort({ lastAt: -1 }).limit(200);
    return NextResponse.json(list.map(toConversationDTO));
}
