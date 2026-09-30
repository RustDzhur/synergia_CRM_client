import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { purchaseNumber } from "@/lib/purchases";
import { defaultCurrency } from "@/lib/finance/settings";
import PurchaseOrder from "@/models/PurchaseOrder";
import Product from "@/models/Product";
import Supplier from "@/models/Supplier";
import User from "@/models/User";
import Warehouse from "@/models/Warehouse";

export const dynamic = "force-dynamic";

// Заказы поставщикам (ТЗ §12): список и создание. Заказ — план; склад меняет приход по накладной.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const list = await PurchaseOrder.find({ org: user.id }).sort({ createdAt: -1 }).limit(200);
    const [suppliers, products, warehouses] = await Promise.all([
        Supplier.find({ org: user.id }).select("name"),
        Product.find({ _id: { $in: list.flatMap((p) => p.lines.map((l: { product: unknown }) => l.product)) } }).select("name sku unit"),
        Warehouse.find({ org: user.id }).select("name"),
    ]);
    const sName = new Map(suppliers.map((s) => [String(s._id), s.name]));
    const wName = new Map(warehouses.map((w) => [String(w._id), w.name]));
    const pInfo = new Map(products.map((p) => [String(p._id), { name: p.name, sku: p.sku ?? "", unit: p.unit ?? "" }]));
    return NextResponse.json(
        list.map((po) => ({
            id: String(po._id),
            number: po.number,
            supplier: po.supplier ? sName.get(String(po.supplier)) ?? "" : "",
            supplierId: po.supplier ? String(po.supplier) : "",
            date: po.date,
            expectedDate: po.expectedDate ?? "",
            status: po.status,
            warehouse: po.warehouse ? wName.get(String(po.warehouse)) ?? "" : "",
            warehouseId: po.warehouse ? String(po.warehouse) : "",
            currency: po.currency,
            notes: po.notes ?? "",
            lines: (po.lines ?? []).map((l: { product: unknown; qty: number; price: number; receivedQty?: number }) => ({
                product: String(l.product),
                name: pInfo.get(String(l.product))?.name ?? "",
                sku: pInfo.get(String(l.product))?.sku ?? "",
                unit: pInfo.get(String(l.product))?.unit ?? "",
                qty: l.qty,
                price: l.price ?? 0,
                receivedQty: l.receivedQty ?? 0,
            })),
        }))
    );
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    const supplierId = String(b?.supplier ?? "");
    const lines = (Array.isArray(b?.lines) ? b.lines : []).filter((l: { product?: string; qty?: number }) => l?.product && Number(l?.qty) > 0);
    if (!supplierId) return badRequest("supplier is required");
    if (!lines.length) return badRequest("lines are required");
    try {
        await connectDB();
        const supplier = await Supplier.findOne({ _id: supplierId, org: user.id });
        if (!supplier) return badRequest("supplier not found");
        const author = await User.findById(user.userId).select("firstname lastname");
        const number = await purchaseNumber(user.id);
        const po = await PurchaseOrder.create({
            org: user.id,
            number,
            supplier: supplier._id,
            date: typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10),
            expectedDate: typeof b?.expectedDate === "string" ? b.expectedDate : "",
            status: "confirmed",
            lines: lines.map((l: { product: string; qty: number; price?: number; note?: string }) => ({ product: l.product, qty: Math.abs(Number(l.qty)), price: Number(l.price) || 0, note: (l.note ?? "").slice(0, 200) })),
            currency: typeof b?.currency === "string" && b.currency ? b.currency.toUpperCase().slice(0, 6) : supplier.currency || (await defaultCurrency(user.id)),
            warehouse: typeof b?.warehouse === "string" && b.warehouse ? b.warehouse : undefined,
            notes: typeof b?.notes === "string" ? b.notes.slice(0, 600) : "",
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
        });
        return NextResponse.json({ id: String(po._id), number: po.number }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
