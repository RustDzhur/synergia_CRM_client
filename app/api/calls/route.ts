import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { recordMessage } from "@/lib/channels";
import type { CallDTO } from "@/app/types/integrations";
import Integration from "@/models/Integration";
import Message from "@/models/Message";

export const dynamic = "force-dynamic";

// GET /api/calls — последние звонки по всем провайдерам (для списка «Недавние» в звонилке)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const rows = await Message.find({ owner: user.id, kind: "call" })
        .sort({ createdAt: -1 })
        .limit(30)
        .populate("conversation", "externalId name channel");
    const list: CallDTO[] = rows
        .filter((m) => m.conversation)
        .map((m) => {
            const c = m.conversation as unknown as { externalId: string; name: string; channel: CallDTO["channel"] };
            return {
                id: m._id.toString(),
                direction: m.direction,
                peer: c.externalId,
                name: c.name,
                status: String(m.meta?.status ?? ""),
                duration: Number(m.meta?.duration) || 0,
                at: m.createdAt.toISOString(),
                integrationId: m.integration.toString(),
                channel: c.channel,
            };
        });
    return NextResponse.json(list);
}

const STATUSES = ["completed", "missed", "no-answer", "busy", "failed"];

// POST /api/calls — браузер сообщает об итоге звонка через SIP-провайдера (у Twilio итог приходит вебхуком с сервера Twilio):
// { integrationId, callId, direction: "in"|"out", peer, status, duration }. Повтор с тем же callId игнорируется.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid JSON");

    const direction = b.direction === "in" ? "in" : b.direction === "out" ? "out" : "";
    const peer = typeof b.peer === "string" ? b.peer.replace(/^sips?:/i, "").split("@")[0].trim().slice(0, 64) : "";
    const status = STATUSES.includes(b.status) ? (b.status as string) : "";
    const callId = typeof b.callId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.callId) ? b.callId : "";
    const duration = Math.min(Math.max(Math.floor(Number(b.duration) || 0), 0), 86400);
    if (!direction || !peer || !status || !callId || !isValidObjectId(b.integrationId)) return badRequest("Invalid call data");

    try {
        await connectDB();
        const integration = await Integration.findOne({ _id: b.integrationId, owner: user.id, type: "sip" });
        if (!integration) return NextResponse.json({ message: "Not found" }, { status: 404 });
        const { duplicate } = await recordMessage(integration, {
            externalId: peer,
            name: peer,
            text: direction === "in" ? "Incoming call" : "Outgoing call",
            direction,
            kind: "call",
            meta: { status, duration },
            messageId: `call:${callId}:${direction}`,
        });
        return NextResponse.json({ ok: true, duplicate }, { status: duplicate ? 200 : 201 });
    } catch (e) {
        return failure(e);
    }
}
