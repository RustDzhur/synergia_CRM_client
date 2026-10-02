import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/orgs/invitations/:id — отозвать приглашение
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.invitation.deleteMany({ where: { id: params.id, org: user.id } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
