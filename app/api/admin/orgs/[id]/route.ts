import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, notFound, validId } from "@/lib/api";
import { FEATURE_KEYS } from "@/app/config/plans";
import Organization from "@/models/Organization";

export const dynamic = "force-dynamic";

// PATCH /api/admin/orgs/:id — { planOverride?, planOverrideUntil?, blocked?, featureOverrides? }
// Ручное назначение тарифа (например, после оплаты по счёту) главнее подписки Stripe, пока не истекло; blocked закрывает фирме доступ.
// featureOverrides — { раздел: true | false | null }: отдельные разделы сверх тарифа (true), отключённые вопреки тарифу (false)
// и возврат к тарифу (null). Разделы из app/config/plans.ts.
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
    if (b.featureOverrides !== undefined) {
        if (b.featureOverrides === null) org.featureOverrides = {};
        else if (typeof b.featureOverrides !== "object" || Array.isArray(b.featureOverrides)) return badRequest("Invalid feature overrides");
        else {
            const next: Record<string, boolean> = {};
            for (const [key, value] of Object.entries(b.featureOverrides as Record<string, unknown>)) {
                if (!(FEATURE_KEYS as readonly string[]).includes(key)) return badRequest(`Unknown section: ${key}`);
                if (typeof value === "boolean") next[key] = value; // true — выдать сверх тарифа, false — отключить вопреки тарифу
            }
            org.featureOverrides = next;
        }
        org.markModified("featureOverrides");
    }
    await org.save();
    return NextResponse.json({ ok: true });
}
