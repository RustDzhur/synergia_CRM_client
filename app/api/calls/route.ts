import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized, validId } from "@/lib/api";
import { recordMessage } from "@/lib/channels";
import type { CallDTO } from "@/types/integrations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/calls — последние звонки по всем провайдерам (для списка «Недавние» в звонилке)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    // populate("conversation") из Mongo заменяем явной выборкой бесед одним запросом
    const rows = await prisma.message.findMany({ where: { owner: user.id, kind: "call" }, orderBy: { createdAt: "desc" }, take: 30 });
    const convIds = Array.from(new Set(rows.map((m) => String(m.conversation))));
    const convs = convIds.length ? await prisma.conversation.findMany({ where: { id: { in: convIds } }, select: { id: true, externalId: true, name: true, channel: true } }) : [];
    const byId = new Map(convs.map((c) => [c.id, c]));
    const list: CallDTO[] = rows
        .map((m) => ({ m, c: byId.get(String(m.conversation)) }))
        .filter(({ c }) => c)
        .map(({ m, c }) => {
            const meta = (m.meta ?? {}) as any;
            return {
                id: m.id,
                direction: m.direction as CallDTO["direction"],
                peer: c!.externalId,
                name: c!.name,
                status: String(meta.status ?? ""),
                duration: Number(meta.duration) || 0,
                at: m.createdAt.toISOString(),
                integrationId: String(m.integration),
                channel: c!.channel as CallDTO["channel"],
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
    if (!direction || !peer || !status || !callId || !validId(String(b.integrationId))) return badRequest("Invalid call data");

    try {
        const integration = await prisma.integration.findFirst({ where: { id: String(b.integrationId), owner: user.id, type: "sip" } });
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
