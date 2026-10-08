import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { revokeLead } from "@/lib/partner/service";
import { partnerFailure } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// DELETE — отозвать заявку: банк перестаёт её видеть сразу, переданные данные стираются, согласие помечается отозванным
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await revokeLead(user.id, user.userId, params.id);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return partnerFailure(e);
    }
}
