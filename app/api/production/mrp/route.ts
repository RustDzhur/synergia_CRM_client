import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { bomIndex } from "@/lib/finance/productionOrders";
import { mrpRequirements } from "@/lib/finance/production";
import { stockOnHand, type MovementLike } from "@/lib/finance/warehouse";
import ProductionOrder from "@/models/ProductionOrder";
import Product from "@/models/Product";
import StockMovement from "@/models/StockMovement";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Планирование потребности (простой MRP, ТЗ §13): что нужно докупить под открытые производственные
// заказы. Считается из тех же спецификаций, что и заказы, — «список закупки» не расходится с планом.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();

    const open = await ProductionOrder.find({ org: user.id, status: { $in: ["plan", "launched"] } });
    const boms = await bomIndex(user.id);
    const orders = open.map((o) => ({ product: String(o.product), qty: Math.max(0, Number(o.planQty) - Number(o.producedQty)), due: o.due ?? "" }));

    const movements = await StockMovement.find({ org: user.id }).select("product qty reason warehouse unitCost createdAt");
    const list: MovementLike[] = movements.map((m) => ({ product: String(m.product), qty: m.qty, reason: String(m.reason), unitCost: m.unitCost ?? 0, at: (m.createdAt ?? new Date()).toISOString() }));
    const rows = mrpRequirements(orders, new Map<string, number>(), boms).map((r) => ({ ...r, inStock: stockOnHand(list, r.product), toBuy: Math.max(0, Math.round((r.required - stockOnHand(list, r.product)) * 10000) / 10000) }));

    const products = await Product.find({ _id: { $in: rows.map((r) => r.product) } }).select("name sku unit purchasePrice");
    const info = new Map(products.map((p) => [String(p._id), p]));
    return NextResponse.json({
        orders: open.length,
        rows: rows.map((r) => ({ ...r, name: info.get(r.product)?.name ?? "", sku: info.get(r.product)?.sku ?? "", unit: info.get(r.product)?.unit ?? "", purchasePrice: info.get(r.product)?.purchasePrice ?? 0 })),
    });
}
