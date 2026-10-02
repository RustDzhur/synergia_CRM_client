import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { createProductionOrder } from "@/lib/finance/productionOrders";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Производственные заказы (ТЗ §13): список и создание из спецификации (взрыв состава делает сервер).

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.productionOrder.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
    const ids = new Set<string>();
    for (const o of list) {
        ids.add(String(o.product));
        for (const m of (o.materials as any[]) ?? []) ids.add(String(m.product));
    }
    const [products, warehouses] = await Promise.all([
        prisma.product.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, name: true, sku: true, unit: true } }),
        prisma.warehouse.findMany({ where: { org: user.id }, select: { id: true, name: true } }),
    ]);
    const info = new Map(products.map((p) => [p.id, { name: p.name, sku: p.sku ?? "", unit: p.unit ?? "" }]));
    const wName = new Map(warehouses.map((w) => [w.id, w.name]));
    return NextResponse.json(
        list.map((o) => ({
            id: o.id,
            number: o.number,
            product: String(o.product),
            productName: info.get(String(o.product))?.name ?? "",
            planQty: o.planQty,
            producedQty: o.producedQty ?? 0,
            scrapQty: o.scrapQty ?? 0,
            status: o.status,
            due: o.due ?? "",
            warehouseMaterials: o.warehouseMaterials ? wName.get(String(o.warehouseMaterials)) ?? "" : "",
            warehouseOutput: o.warehouseOutput ? wName.get(String(o.warehouseOutput)) ?? "" : "",
            costs: o.costs,
            planCost: o.planCost ?? 0,
            materials: ((o.materials as any[]) ?? []).map((m: { product: unknown; qty: number; usedQty?: number; unitCost?: number }) => ({
                product: String(m.product),
                name: info.get(String(m.product))?.name ?? "",
                unit: info.get(String(m.product))?.unit ?? "",
                qty: m.qty,
                usedQty: m.usedQty ?? 0,
                unitCost: m.unitCost ?? 0,
            })),
            operations: ((o.operations as any[]) ?? []).map((op: { name: string; minutes: number; actualMinutes?: number; costPerHour: number }) => ({ name: op.name, minutes: op.minutes, actualMinutes: op.actualMinutes ?? 0, costPerHour: op.costPerHour })),
        }))
    );
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    try {
        const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const order = await createProductionOrder(user.id, {
            product: String(b?.product ?? ""),
            qty: Number(b?.qty) || 0,
            warehouseMaterials: typeof b?.warehouseMaterials === "string" ? b.warehouseMaterials : undefined,
            warehouseOutput: typeof b?.warehouseOutput === "string" ? b.warehouseOutput : undefined,
            due: typeof b?.due === "string" ? b.due : "",
            note: typeof b?.note === "string" ? b.note : "",
            by: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        });
        await logAudit({ org: user.id, userId: user.userId, action: "production.create", entityType: "production", entityId: order.id, summary: `Production order ${order.number} planned (${order.planQty} pcs)`, meta: {} });
        return NextResponse.json({ id: order.id, number: order.number, planCost: order.planCost }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
