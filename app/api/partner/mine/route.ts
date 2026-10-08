import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { referralsOfOrg, setShareVolume } from "@/lib/partner/service";
import { partnerFailure } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ referrals: await referralsOfOrg(user.id) });
}

// PATCH { id, shareVolume } — клиент в любой момент включает или отзывает согласие на учёт объёма в агрегатах банка
export async function PATCH(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b.id !== "string" || typeof b.shareVolume !== "boolean") return badRequest("id and shareVolume are required");
    try {
        await setShareVolume(user.id, b.id, b.shareVolume);
        return NextResponse.json({ ok: true });
    } catch (e) {
        return partnerFailure(e);
    }
}
