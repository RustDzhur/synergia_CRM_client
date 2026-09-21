import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import Invitation from "@/models/Invitation";

export const dynamic = "force-dynamic";

// DELETE /api/orgs/invitations/:id — отозвать приглашение
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await Invitation.deleteOne({ _id: params.id, org: user.id });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
