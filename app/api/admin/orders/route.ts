import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { listOrders } from "@/lib/transferPay";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/orders — счета на тарифы, ждущие подтверждения оплаты (заявленные клиентом — сверху), и недавно оплаченные
export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const orders = (await listOrders()).filter((o) => o.status !== "cancelled").slice(0, 60);
    const orgs = await prisma.organization.findMany({ where: { id: { in: orders.map((o) => o.org) } }, select: { id: true, name: true } });
    const rank = { claimed: 0, new: 1, paid: 2, cancelled: 3 } as const;
    return NextResponse.json(orders.map((o) => ({ ...o, orgName: orgs.find((x) => x.id === o.org)?.name ?? "" })).sort((a, b) => rank[a.status] - rank[b.status]));
}
