import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { inviteFromClient, linksForOrg } from "@/lib/practice/service";
import { practiceFailure } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

// GET — практики, имеющие доступ к фирме (и приглашения); POST { practiceCode, access, modules, expiresInDays, note } — пригласить своего специалиста
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        return NextResponse.json({ links: await linksForOrg(user.id, user.role) });
    } catch (e) {
        return practiceFailure(e);
    }
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        const link = await inviteFromClient(user.id, { userId: user.userId, role: user.role }, b);
        return NextResponse.json({ id: link.id, status: link.status }, { status: 201 });
    } catch (e) {
        return practiceFailure(e);
    }
}
