import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, notFound, validId } from "@/lib/api";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

// PATCH /api/admin/orgs/:id — { planOverride?: "" | "free" | "standard" | "professional", planOverrideUntil?: ISO | null, blocked?: boolean }
// Ручное назначение тарифа (например, после оплаты по счёту) главнее подписки Stripe, пока не истекло; blocked закрывает фирме доступ.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid JSON");
    const org = await Organization.findById(params.id);
    if (!org) return notFound();
    if ("planOverride" in b) {
        if (!["", "free", "standard", "professional"].includes(b.planOverride)) return badRequest("Invalid plan");
        org.planOverride = b.planOverride;
        if (!b.planOverride) org.planOverrideUntil = undefined;
    }
    if ("planOverrideUntil" in b) {
        if (b.planOverrideUntil === null || b.planOverrideUntil === "") org.planOverrideUntil = undefined;
        else {
            const d = new Date(b.planOverrideUntil);
            if (Number.isNaN(d.getTime())) return badRequest("Invalid date");
            org.planOverrideUntil = d;
        }
    }
    if (typeof b.blocked === "boolean") org.blocked = b.blocked;
    await org.save();
    return NextResponse.json({ ok: true });
}
