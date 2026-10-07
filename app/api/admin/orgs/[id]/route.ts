import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest, notFound, validId } from "@/lib/api";
import { FEATURE_KEYS } from "@/config/plans";
import { PROMO } from "@/config/promo";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/admin/orgs/:id — { planOverride?, planOverrideUntil?, blocked?, featureOverrides?, promo? }
// Ручное назначение тарифа (например, после оплаты по счёту) главнее базового тарифа, пока не истекло; blocked закрывает фирме доступ.
// featureOverrides — { раздел: true | false | null }: отдельные разделы сверх тарифа (true), отключённые вопреки тарифу (false)
// и возврат к тарифу (null). Разделы из app/config/plans.ts.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid JSON");
    const org = await prisma.organization.findUnique({ where: { id: params.id } });
    if (!org) return notFound();
    const data: Record<string, unknown> = {};
    if ("planOverride" in b) {
        if (!["", "free", "standard", "professional"].includes(b.planOverride)) return badRequest("Invalid plan");
        data.planOverride = b.planOverride;
        if (!b.planOverride) data.planOverrideUntil = null;
    }
    if ("planOverrideUntil" in b) {
        if (b.planOverrideUntil === null || b.planOverrideUntil === "") data.planOverrideUntil = null;
        else {
            const d = new Date(b.planOverrideUntil);
            if (Number.isNaN(d.getTime())) return badRequest("Invalid date");
            data.planOverrideUntil = d;
        }
    }
    // Программа «первые 500 — год бесплатно»: promo=true открывает полный тариф на PROMO.months месяцев (повторно срок не продлевается),
    // promo=false снимает отметку и ручной тариф
    if (typeof b.promo === "boolean") {
        const billing = (org.billing && typeof org.billing === "object" && !Array.isArray(org.billing) ? org.billing : {}) as Record<string, unknown>;
        if (b.promo) {
            if (!billing.promo) {
                const until = new Date();
                until.setMonth(until.getMonth() + PROMO.months);
                billing.promo = { grantedAt: new Date().toISOString(), until: until.toISOString() };
                data.planOverride = PROMO.plan;
                data.planOverrideUntil = until;
            }
        } else {
            delete billing.promo;
            data.planOverride = "";
            data.planOverrideUntil = null;
        }
        data.billing = billing;
    }
    if (typeof b.blocked === "boolean") data.blocked = b.blocked;
    if (b.featureOverrides !== undefined) {
        if (b.featureOverrides === null) data.featureOverrides = {};
        else if (typeof b.featureOverrides !== "object" || Array.isArray(b.featureOverrides)) return badRequest("Invalid feature overrides");
        else {
            const next: Record<string, boolean> = {};
            for (const [key, value] of Object.entries(b.featureOverrides as Record<string, unknown>)) {
                if (!(FEATURE_KEYS as readonly string[]).includes(key)) return badRequest(`Unknown section: ${key}`);
                if (typeof value === "boolean") next[key] = value; // true — выдать сверх тарифа, false — отключить вопреки тарифу
            }
            data.featureOverrides = next;
        }
    }
    await prisma.organization.update({ where: { id: org.id }, data: data as any });
    return NextResponse.json({ ok: true });
}
