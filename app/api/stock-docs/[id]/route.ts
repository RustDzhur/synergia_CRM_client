import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/stock-docs/:id — документ целиком для просмотра: строки с товарами (для инвентаризации —
// учёт, факт и расхождение), движения, которые он провёл, и номера сторно в обе стороны.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const doc = await prisma.stockDoc.findFirst({ where: { id: params.id, org: user.id } });
    if (!doc) return notFound();

    const lines = ((doc.lines ?? []) as any[]) as Array<{ product: unknown; qty: number; price?: number; diff?: number; note?: string }>;
    const productIds = Array.from(new Set(lines.map((l) => String(l.product))));
    const [products, warehouses, movements, reversal, reversalDoc] = await Promise.all([
        productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true, unit: true } }) : [],
        prisma.warehouse.findMany({ where: { org: user.id }, select: { id: true, name: true } }),
        prisma.stockMovement.findMany({ where: { org: user.id, doc: doc.id }, select: { id: true, product: true, qty: true, reason: true, unitCost: true, warehouse: true, note: true } }),
        doc.reversedBy ? prisma.stockDoc.findUnique({ where: { id: String(doc.reversedBy) }, select: { number: true } }) : null,
        doc.reversalOf ? prisma.stockDoc.findUnique({ where: { id: String(doc.reversalOf) }, select: { number: true } }) : null,
    ]);
    const pInfo = new Map(products.map((p) => [p.id, p]));
    const wName = new Map(warehouses.map((w) => [w.id, w.name]));

    return NextResponse.json({
        id: doc.id,
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
        lines: lines.map((l) => ({
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
            id: m.id,
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
