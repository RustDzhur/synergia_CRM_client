import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { cleanBarcode, cleanImage, cleanPrices } from "@/lib/finance/productFields";
import { prisma } from "@/lib/prisma";

const toDTO = (p: any) => ({
    id: p.id, name: p.name, sku: p.sku, type: p.type, unit: p.unit,
    purchasePrice: p.purchasePrice, salePrice: p.salePrice, taxRate: p.taxRate,
    stockQty: p.stockQty, reorderLevel: p.reorderLevel, archived: !!p.archived,
    image: p.image ?? "",
    barcode: p.barcode ?? "",
    hsCode: p.hsCode ?? "",
    weightKg: p.weightKg ?? 0,
    originCountry: p.originCountry ?? "",
    prices: Array.isArray(p.prices) ? p.prices.map((x: { type?: string; price?: number; minQty?: number }) => ({ type: String(x.type ?? ""), price: Number(x.price) || 0, minQty: Number(x.minQty) || 1 })) : [],
});

// PATCH /api/products/:id — правка полей; остаток (stockQty) отсюда не меняется — только через движения склада.
// Принимаются те же поля, что и в POST: раньше правка умела только имя/цены, и сохранение карточки молча
// теряло тип, картинку и данные ВЭД.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const b = await req.json().catch(() => ({}));
    const product = await prisma.product.findUnique({ where: { id: params.id } });
    if (!product || product.org !== user.id) return notFound();
    const set: Record<string, unknown> = {};
    if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim().slice(0, 200);
    if (typeof b.sku === "string") set.sku = b.sku.trim().slice(0, 60);
    if (typeof b.barcode === "string") set.barcode = cleanBarcode(b.barcode);
    if (typeof b.unit === "string" && b.unit.trim()) set.unit = b.unit.trim().slice(0, 20);
    if (b.purchasePrice !== undefined) set.purchasePrice = Math.max(0, Number(b.purchasePrice) || 0);
    if (b.salePrice !== undefined) set.salePrice = Math.max(0, Number(b.salePrice) || 0);
    if (b.reorderLevel !== undefined) set.reorderLevel = Math.max(0, Number(b.reorderLevel) || 0);
    if (b.taxRate !== undefined) { const r = Number(b.taxRate); set.taxRate = Number.isFinite(r) ? Math.min(100, Math.max(0, r)) : null; }
    if (typeof b.archived === "boolean") set.archived = b.archived;
    if (typeof b.image === "string") set.image = cleanImage(b.image);
    if (b.prices !== undefined) set.prices = cleanPrices(b.prices);
    if (typeof b.hsCode === "string") set.hsCode = b.hsCode.trim().slice(0, 20);
    if (b.weightKg !== undefined) set.weightKg = Math.max(0, Number(b.weightKg) || 0);
    if (typeof b.originCountry === "string") set.originCountry = b.originCountry.trim().toUpperCase().slice(0, 2);
    // Тип можно исправить: карточка, заведённая как «Послуга», не имела остатка и не могла участвовать
    // в складе/производстве — теперь её можно перевести в «Товар». Обратно (товар в услугу) — только
    // при нулевом остатке, иначе остаток пропал бы из отчётов
    if (b.type === "good" || b.type === "service") {
        if (b.type === "service" && product.type === "good" && Number(product.stockQty) !== 0) {
            return badRequest("Спочатку спішіть залишок товару (він не нульовий) — потім змінюйте тип на «Послуга»");
        }
        set.type = b.type;
    }
    const updated = await prisma.product.update({ where: { id: params.id }, data: set as any });
    return NextResponse.json(toDTO(updated));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const r = await prisma.product.deleteMany({ where: { id: params.id, org: user.id } });
    return r.count ? NextResponse.json({ ok: true }) : notFound();
}
