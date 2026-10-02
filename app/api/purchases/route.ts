import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { purchaseNumber } from "@/lib/purchases";
import { defaultCurrency } from "@/lib/finance/settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Заказы поставщикам (ТЗ §12): список и создание. Заказ — план; склад меняет приход по накладной.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const list = await prisma.purchaseOrder.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 200 });
    const productIds = Array.from(new Set(list.flatMap((p) => (((p.lines ?? []) as any[]).map((l) => String(l.product))))));
    const [suppliers, products, warehouses] = await Promise.all([
        prisma.supplier.findMany({ where: { org: user.id }, select: { id: true, name: true } }),
        productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, sku: true, unit: true } }) : [],
        prisma.warehouse.findMany({ where: { org: user.id }, select: { id: true, name: true } }),
    ]);
    const sName = new Map(suppliers.map((s) => [s.id, s.name]));
    const wName = new Map(warehouses.map((w) => [w.id, w.name]));
    const pInfo = new Map(products.map((p) => [p.id, { name: p.name, sku: p.sku ?? "", unit: p.unit ?? "" }]));
    return NextResponse.json(
        list.map((po) => ({
            id: po.id,
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
            lines: ((po.lines ?? []) as any[]).map((l: { product: unknown; qty: number; price: number; receivedQty?: number }) => ({
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
        const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, org: user.id } });
        if (!supplier) return badRequest("supplier not found");
        const author = await prisma.user.findUnique({ where: { id: user.userId }, select: { firstname: true, lastname: true } });
        const number = await purchaseNumber(user.id);
        const po = await prisma.purchaseOrder.create({
            data: {
            org: user.id,
            number,
            supplier: supplier.id,
            date: typeof b?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10),
            expectedDate: typeof b?.expectedDate === "string" ? b.expectedDate : "",
            status: "confirmed",
            lines: lines.map((l: { product: string; qty: number; price?: number; note?: string }) => ({ product: l.product, qty: Math.abs(Number(l.qty)), price: Number(l.price) || 0, note: (l.note ?? "").slice(0, 200) })),
            currency: typeof b?.currency === "string" && b.currency ? b.currency.toUpperCase().slice(0, 6) : supplier.currency || (await defaultCurrency(user.id)),
            warehouse: typeof b?.warehouse === "string" && b.warehouse ? b.warehouse : undefined,
            notes: typeof b?.notes === "string" ? b.notes.slice(0, 600) : "",
            createdByName: author ? `${author.firstname} ${author.lastname}`.trim() : "",
            },
        });
        return NextResponse.json({ id: po.id, number: po.number }, { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
