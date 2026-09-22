import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import Product from "@/models/Product";

const toDTO = (p: any) => ({
    id: String(p._id), name: p.name, sku: p.sku, type: p.type, unit: p.unit,
    purchasePrice: p.purchasePrice, salePrice: p.salePrice, taxRate: p.taxRate,
    stockQty: p.stockQty, reorderLevel: p.reorderLevel, archived: !!p.archived,
});

// PATCH /api/products/:id — правка полей; остаток (stockQty) отсюда не меняется — только через движения склада
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const set: Record<string, unknown> = {};
    if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim().slice(0, 200);
    if (typeof b.sku === "string") set.sku = b.sku.trim().slice(0, 60);
    if (typeof b.unit === "string" && b.unit.trim()) set.unit = b.unit.trim().slice(0, 20);
    if (b.purchasePrice !== undefined) set.purchasePrice = Math.max(0, Number(b.purchasePrice) || 0);
    if (b.salePrice !== undefined) set.salePrice = Math.max(0, Number(b.salePrice) || 0);
    if (b.reorderLevel !== undefined) set.reorderLevel = Math.max(0, Number(b.reorderLevel) || 0);
    if (b.taxRate !== undefined) { const r = Number(b.taxRate); set.taxRate = Number.isFinite(r) ? Math.min(100, Math.max(0, r)) : null; }
    if (typeof b.archived === "boolean") set.archived = b.archived;
    const p = await Product.findOneAndUpdate({ _id: params.id, org: user.id }, { $set: set }, { new: true });
    return p ? NextResponse.json(toDTO(p)) : notFound();
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const r = await Product.deleteOne({ _id: params.id, org: user.id });
    return r.deletedCount ? NextResponse.json({ ok: true }) : notFound();
}
