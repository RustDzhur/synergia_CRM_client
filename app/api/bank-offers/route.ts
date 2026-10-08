import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { LEAD_FIELDS, activeBanks, createLead, leadsOfOrg } from "@/lib/partner/service";
import { partnerFailure } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// GET — банки, которым можно отправить заявку (без эксклюзивности: все активные), поля, которыми можно поделиться, и свои заявки
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    return NextResponse.json({ banks: await activeBanks(), fields: LEAD_FIELDS, leads: await leadsOfOrg(user.id) });
}

// POST { partnerId, fields[], days? } — «Получить предложение банка»: банку уходит только выбранное, на срок; фиксируется в ConsentRecord
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b.partnerId !== "string") return badRequest("partnerId is required");
    try {
        const lead = await createLead(user.id, user.userId, b.partnerId, b.fields, b.days);
        return NextResponse.json({ id: lead.id, expiresAt: lead.expiresAt }, { status: 201 });
    } catch (e) {
        return partnerFailure(e);
    }
}
