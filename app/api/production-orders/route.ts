import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { createProductionOrder } from "@/lib/finance/productionOrders";
import { logAudit } from "@/lib/audit";
import ProductionOrder from "@/models/ProductionOrder";
import Product from "@/models/Product";
import User from "@/models/User";
import Warehouse from "@/models/Warehouse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Производственные заказы (ТЗ §13): список и создание из спецификации (взрыв состава делает сервер).

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const list = await ProductionOrder.find({ org: user.id }).sort({ createdAt: -1 }).limit(200);
    const ids = new Set<string>();
    for (const o of list) {
        ids.add(String(o.product));
        for (const m of o.materials ?? []) ids.add(String(m.product));
    }
    const [products, warehouses] = await Promise.all([
        Product.find({ _id: { $in: Array.from(ids) } }).select("name sku unit"),
        Warehouse.find({ org: user.id }).select("name"),
    ]);
    const info = new Map(products.map((p) => [String(p._id), { name: p.name, sku: p.sku ?? "", unit: p.unit ?? "" }]));
    const wName = new Map(warehouses.map((w) => [String(w._id), w.name]));
    return NextResponse.json(
        list.map((o) => ({
            id: String(o._id),
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
            materials: (o.materials ?? []).map((m: { product: unknown; qty: number; usedQty?: number; unitCost?: number }) => ({
                product: String(m.product),
                name: info.get(String(m.product))?.name ?? "",
                unit: info.get(String(m.product))?.unit ?? "",
                qty: m.qty,
                usedQty: m.usedQty ?? 0,
                unitCost: m.unitCost ?? 0,
            })),
            operations: (o.operations ?? []).map((op: { name: string; minutes: number; actualMinutes?: number; costPerHour: number }) => ({ name: op.name, minutes: op.minutes, actualMinutes: op.actualMinutes ?? 0, costPerHour: op.costPerHour })),
        }))
    );
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    try {
        await connectDB();
        const author = await User.findById(user.userId).select("firstname lastname");
        const order = await createProductionOrder(user.id, {
            product: String(b?.product ?? ""),
            qty: Number(b?.qty) || 0,
            warehouseMaterials: typeof b?.warehouseMaterials === "string" ? b.warehouseMaterials : undefined,
            warehouseOutput: typeof b?.warehouseOutput === "string" ? b.warehouseOutput : undefined,
            due: typeof b?.due === "string" ? b.due : "",
            note: typeof b?.note === "string" ? b.note : "",
            by: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        });
        await logAudit({ org: user.id, userId: user.userId, action: "production.create", entityType: "production", entityId: String(order._id), summary: `Production order ${order.number} planned (${order.planQty} pcs)`, meta: {} });
        return NextResponse.json({ id: String(order._id), number: order.number, planCost: order.planCost }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
