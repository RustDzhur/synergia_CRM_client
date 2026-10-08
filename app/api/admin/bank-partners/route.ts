import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/api";
import { addMember, createPartner } from "@/lib/partner/service";
import { partnerFailure } from "@/lib/partner/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const [partners, codes] = await Promise.all([prisma.bankPartner.findMany({ orderBy: { createdAt: "asc" } }), prisma.bankPartnerCode.findMany()]);
    return NextResponse.json({ partners: partners.map((p) => ({ ...p, codes: codes.filter((c) => c.partner === p.id).map((c) => c.code) })) });
}

// POST { name, bankProvider?, memberEmail? } — завести банк-партнёра (с одним кодом); POST { partnerId, memberEmail } — добавить сотрудника банка
export async function POST(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        if (typeof b.partnerId === "string") {
            await addMember(b.partnerId, String(b.memberEmail ?? ""));
            return NextResponse.json({ ok: true });
        }
        return NextResponse.json(await createPartner(b), { status: 201 });
    } catch (e) {
        return partnerFailure(e);
    }
}
