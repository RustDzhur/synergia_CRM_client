import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/requests — запросы счёта на банковский перевод (новые сверху)
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const list = await prisma.invoiceRequest.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
    const orgs = await prisma.organization.findMany({ where: { id: { in: list.map((r) => r.org) } }, select: { id: true, name: true } });
    return NextResponse.json(list.map((r) => ({ id: r.id, orgId: r.org, orgName: orgs.find((o) => o.id === r.org)?.name ?? "", email: r.email, plan: r.plan, interval: r.interval, company: r.company, vatId: r.vatId, note: r.note, status: r.status, createdAt: r.createdAt.toISOString() })));
}
