import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import StockDoc from "@/models/StockDoc";
import StockMovement from "@/models/StockMovement";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";

export const dynamic = "force-dynamic";

// GET /api/stock-docs/:id — документ целиком для просмотра: строки с товарами (для инвентаризации —
// учёт, факт и расхождение), движения, которые он провёл, и номера сторно в обе стороны.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const doc = await StockDoc.findOne({ _id: params.id, org: user.id });
    if (!doc) return notFound();

    const productIds = (doc.lines ?? []).map((l: { product: unknown }) => l.product);
    const [products, warehouses, movements, reversal, reversalDoc] = await Promise.all([
        Product.find({ _id: { $in: productIds } }).select("name sku unit"),
        Warehouse.find({ org: user.id }).select("name"),
        StockMovement.find({ org: user.id, doc: doc._id }).select("product qty reason unitCost warehouse note"),
        doc.reversedBy ? StockDoc.findOne({ _id: doc.reversedBy }).select("number") : null,
        doc.reversalOf ? StockDoc.findOne({ _id: doc.reversalOf }).select("number") : null,
    ]);
    const pInfo = new Map(products.map((p) => [String(p._id), p]));
    const wName = new Map(warehouses.map((w) => [String(w._id), w.name]));

    return NextResponse.json({
        id: String(doc._id),
        kind: doc.kind,
        number: doc.number,
        date: doc.date,
        note: doc.note ?? "",
        by: doc.by ?? "",
        warehouseFrom: doc.warehouseFrom ? wName.get(String(doc.warehouseFrom)) ?? "" : "",
        warehouseTo: doc.warehouseTo ? wName.get(String(doc.warehouseTo)) ?? "" : "",
        reversed: !!doc.reversedBy,
        reversalNumber: reversal?.number ?? "",
        reversalOf: doc.reversalOf ? String(doc.reversalOf) : "",
        reversalOfNumber: reversalDoc?.number ?? "",
        lines: (doc.lines ?? []).map((l: { product: unknown; qty: number; price?: number; diff?: number; note?: string }) => ({
            product: String(l.product),
            name: pInfo.get(String(l.product))?.name ?? "",
            sku: pInfo.get(String(l.product))?.sku ?? "",
            unit: pInfo.get(String(l.product))?.unit ?? "",
            qty: l.qty,
            price: l.price ?? 0,
            diff: l.diff ?? 0,
            note: l.note ?? "",
        })),
        movements: movements.map((m) => ({
            id: String(m._id),
            product: String(m.product),
            name: pInfo.get(String(m.product))?.name ?? "",
            qty: m.qty,
            reason: m.reason,
            unitCost: m.unitCost ?? 0,
            warehouse: m.warehouse ? wName.get(String(m.warehouse)) ?? "" : "",
            note: m.note ?? "",
        })),
    });
}
