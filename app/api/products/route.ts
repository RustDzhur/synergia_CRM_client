import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { escapeRegex } from "@/lib/crmFields";
import Product from "@/models/Product";

export const dynamic = "force-dynamic";

const toDTO = (p: any) => ({
    id: String(p._id), name: p.name, sku: p.sku, type: p.type, unit: p.unit,
    purchasePrice: p.purchasePrice, salePrice: p.salePrice, taxRate: p.taxRate,
    stockQty: p.stockQty, reorderLevel: p.reorderLevel, archived: !!p.archived,
    image: p.image ?? "",
    hsCode: p.hsCode ?? "",
    weightKg: p.weightKg ?? 0,
    originCountry: p.originCountry ?? "",
    // Типы цен и ступени (ТЗ §12): «опт / партнер», цена и минимальное количество
    prices: Array.isArray(p.prices) ? p.prices.map((x: { type?: string; price?: number; minQty?: number }) => ({ type: String(x.type ?? ""), price: Number(x.price) || 0, minQty: Number(x.minQty) || 1 })) : [],
});

// GET /api/products?q=&type=&archived= — каталог товаров и услуг (для выбора в заказе/счёте и для страницы Products)
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const type = url.searchParams.get("type");
    await connectDB();
    const filter: Record<string, unknown> = { org: user.id, archived: url.searchParams.get("archived") === "1" };
    if (q) filter.$or = [{ name: new RegExp(escapeRegex(q), "i") }, { sku: new RegExp(escapeRegex(q), "i") }];
    if (type === "good" || type === "service") filter.type = type;
    const list = await Product.find(filter).sort({ name: 1 }).limit(500);
    return NextResponse.json(list.map(toDTO));
}

// POST /api/products
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    const name = typeof b?.name === "string" ? b.name.trim().slice(0, 200) : "";
    if (!name) return badRequest("Name is required");
    const type = b.type === "good" ? "good" : "service";
    await connectDB();
    const rate = Number(b.taxRate);
    const product = await Product.create({
        org: user.id, name, type,
        sku: typeof b.sku === "string" ? b.sku.trim().slice(0, 60) : "",
        unit: typeof b.unit === "string" && b.unit.trim() ? b.unit.trim().slice(0, 20) : "pcs",
        purchasePrice: Math.max(0, Number(b.purchasePrice) || 0),
        salePrice: Math.max(0, Number(b.salePrice) || 0),
        taxRate: Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : null,
        stockQty: type === "good" ? Math.max(0, Number(b.stockQty) || 0) : 0,
        reorderLevel: Math.max(0, Number(b.reorderLevel) || 0),
        image: typeof b.image === "string" && /^https?:\/\//.test(b.image.trim()) ? b.image.trim().slice(0, 500) : "",
        prices: cleanPrices(b.prices),
        hsCode: typeof b.hsCode === "string" ? b.hsCode.trim().slice(0, 20) : "",
        weightKg: Math.max(0, Number(b.weightKg) || 0),
        originCountry: typeof b.originCountry === "string" ? b.originCountry.trim().toUpperCase().slice(0, 2) : "",
    });
    return NextResponse.json(toDTO(product), { status: 201 });
}

// Прайс товара: строки «тип цены, цена, от какого количества». Пустые и нулевые цены отбрасываются:
// ноль в прайсе — это «не задано», а не «бесплатно» (см. priceFor в lib/finance/pricing.ts).
function cleanPrices(raw: unknown): Array<{ type: string; price: number; minQty: number }> {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((x: { type?: unknown; price?: unknown; minQty?: unknown }) => ({
            type: String(x?.type ?? "").trim().slice(0, 40),
            price: Math.max(0, Number(x?.price) || 0),
            minQty: Math.max(1, Math.round(Number(x?.minQty) || 1)),
        }))
        .filter((x) => x.price > 0)
        .slice(0, 20);
}
