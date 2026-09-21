import { connectDB } from "@/lib/mongodb";
import { rateLimited } from "@/lib/rateLimit";
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
    const { message } = await recordMessage(integration, { externalId: body.visitor, name, text });
    return corsJson(message ? toMessageDTO(message) : null, 201);
}
