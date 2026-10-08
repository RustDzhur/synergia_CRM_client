import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { deleteRule } from "@/lib/review/rules";
import { reviewFailure } from "@/lib/review/http";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await deleteRule(user.id, user.role, params.id);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return reviewFailure(e);
    }
}
