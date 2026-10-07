import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { effectivePlan } from "@/lib/billing";
import { orgFeatures } from "@/lib/features";
import { DEMO_DOMAIN } from "@/lib/demo/rules";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/orgs?q= — фирмы платформы: владелец, тариф, подписка, число участников (последние 200)
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
    // поиск по названию фирмы и по владельцу (почта/имя) — как раньше делал $or с регулярным выражением
    const like = (v: string) => ({ contains: v, mode: "insensitive" as const });
    let filter: Record<string, unknown> = {};
    if (q) {
        const owners = await prisma.user.findMany({ where: { OR: [{ email: like(q) }, { firstname: like(q) }, { lastname: like(q) }] }, select: { id: true } });
        filter = { OR: [{ name: like(q) }, { ownerUser: { in: owners.map((o) => o.id) } }] };
    }
    // временные демо-кабинеты посетителей (lib/demo) в списке фирм не нужны
    const demoIds = (await prisma.user.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } })).map((u) => u.id);
    if (demoIds.length) filter = { AND: [filter, { NOT: { ownerUser: { in: demoIds } } }] };
    const orgs = await prisma.organization.findMany({ where: filter as any, orderBy: { createdAt: "desc" }, take: 200 });
    const owners = await prisma.user.findMany({ where: { id: { in: orgs.map((o) => o.ownerUser) } }, select: { id: true, email: true, firstname: true, lastname: true } });
    const counts = await prisma.membership.groupBy({ by: ["org"], where: { org: { in: orgs.map((o) => o.id) } }, _count: { _all: true } });
    return NextResponse.json(
        orgs.map((o) => {
            const u = owners.find((x) => x.id === o.ownerUser);
            return {
                id: o.id,
                name: o.name,
                ownerEmail: u?.email ?? "",
                ownerName: u ? `${u.firstname} ${u.lastname}` : "",
                plan: effectivePlan(o),
                override: o.planOverride || "",
                overrideUntil: o.planOverrideUntil ? o.planOverrideUntil.toISOString() : "",
                promoUntil: ((o.billing as { promo?: { until?: string } } | null)?.promo?.until) ?? "",
                members: counts.find((c) => c.org === o.id)?._count._all ?? 0,
                blocked: !!o.blocked,
                // что реально доступно фирме: набор тарифа плюс ручные переключатели разделов
                features: orgFeatures(o),
                featureOverrides: o.featureOverrides ?? {},
                createdAt: o.createdAt.toISOString(),
            };
        })
    );
}
