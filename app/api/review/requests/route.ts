import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { createRequest, listRequests } from "@/lib/review/service";
import { actorOf, reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";

// GET ?status=open — запросы специалистов клиенту; POST { subject, body?, entityType?, entityId? } — новый запрос
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ requests: await listRequests(user.id, new URL(req.url).searchParams.get("status") ?? undefined) });
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        const link = user.role === "advisor" || user.role === "counsel" ? (await (await import("@/lib/prisma")).prisma.membership.findFirst({ where: { org: user.id, user: user.userId } }))?.link ?? "" : "";
        return NextResponse.json(await createRequest(user.id, await actorOf(user), { ...b, link }), { status: 201 });
    } catch (e) {
        return reviewFailure(e);
    }
}
