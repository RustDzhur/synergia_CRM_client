import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { attachReferral } from "@/lib/partner/service";
import { partnerFailure } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// POST { code, shareVolume? } — фирма пришла по ссылке банка. Объём платежей попадёт в агрегаты банка только при shareVolume: true.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b.code !== "string") return badRequest("code is required");
    try {
        return NextResponse.json(await attachReferral(user.id, b.code.slice(0, 20), b.shareVolume === true), { status: 201 });
    } catch (e) {
        return partnerFailure(e);
    }
}
