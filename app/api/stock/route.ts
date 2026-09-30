import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { abcAnalysis, deadStock, stockAt, stockByWarehouse, stockOnHand, turnover, type MovementLike } from "@/lib/finance/warehouse";
import StockMovement from "@/models/StockMovement";
import Product from "@/models/Product";
import Warehouse from "@/models/Warehouse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/stock?kind=… — складские отчёты (ТЗ §12): оборотка, остатки на дату, карточка товара,
// неликвид, ABC. Всё считается из журнала движений — того же, что меняет остаток, поэтому отчёты
// сходятся с карточкой товара по определению.

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? "on-hand";
    await connectDB();

    const movements = await StockMovement.find({ org: user.id }).sort({ createdAt: 1 }).limit(20000);
    const list: MovementLike[] = movements.map((m) => ({
        product: String(m.product),
        warehouse: m.warehouse ? String(m.warehouse) : null,
        qty: m.qty,
        reason: String(m.reason),
        unitCost: m.unitCost ?? 0,
        at: (m.createdAt ?? new Date()).toISOString(),
    }));
    const products = await Product.find({ org: user.id }).select("name sku unit stockQty reorderLevel purchasePrice salePrice type");
    const info = new Map(products.map((p) => [String(p._id), p]));

    if (kind === "on-hand") {
        // Остатки по складам: сумма движений по каждому складу, не кэш поля
        const warehouses = await Warehouse.find({ org: user.id }).select("name");
        const by = stockByWarehouse(list);
        const rows = products
            .filter((p) => p.type === "good")
            .map((p) => {
                const id = String(p._id);
                return {
                    id,
                    name: p.name,
                    sku: p.sku ?? "",
                    unit: p.unit ?? "",
                    total: stockOnHand(list, id),
                    byWarehouse: Object.fromEntries(warehouses.map((w) => [String(w._id), by[String(w._id)]?.[id] ?? 0])),
                    reorderLevel: p.reorderLevel ?? 0,
                };
            });
        return NextResponse.json({ warehouses: warehouses.map((w) => ({ id: String(w._id), name: w.name })), rows });
    }

    if (kind === "date") {
        const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
        return NextResponse.json({
            date,
            rows: products
                .filter((p) => p.type === "good")
                .map((p) => ({ id: String(p._id), name: p.name, sku: p.sku ?? "", qty: stockAt(list, date, String(p._id)) }))
                .filter((r) => r.qty !== 0),
        });
    }

    if (kind === "turnover") {
        const from = url.searchParams.get("from") ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
        return NextResponse.json({
            from,
            to,
            rows: turnover(list, from, to).map((r) => ({ ...r, name: info.get(r.product)?.name ?? "", sku: info.get(r.product)?.sku ?? "", unit: info.get(r.product)?.unit ?? "" })),
        });
    }

    if (kind === "card") {
        const product = url.searchParams.get("product") ?? "";
        if (!product) return badRequest("product is required");
        const rows = movements
            .filter((m) => String(m.product) === product)
            .map((m) => ({ at: (m.createdAt ?? new Date()).toISOString(), qty: m.qty, reason: m.reason, unitCost: m.unitCost ?? 0, note: m.note ?? "" }));
        return NextResponse.json({ product: info.get(product)?.name ?? "", unit: info.get(product)?.unit ?? "", onHand: stockOnHand(list, product), rows });
    }

    if (kind === "dead") {
        const days = Math.max(30, Number(url.searchParams.get("days")) || 90);
        const today = new Date().toISOString().slice(0, 10);
        return NextResponse.json({ days, rows: deadStock(list, today, days).map((id) => ({ id, name: info.get(id)?.name ?? "", qty: stockOnHand(list, id) })) });
    }

    if (kind === "abc") {
        // Выручка по товарам — из движений продаж: цена продажи берётся из карточки товара
        const sales = new Map<string, number>();
        for (const m of movements) {
            if (m.reason !== "sale" && m.reason !== "issue") continue;
            const price = Number(info.get(String(m.product))?.salePrice) || m.unitCost || 0;
            sales.set(String(m.product), (sales.get(String(m.product)) ?? 0) + Math.abs(m.qty) * price);
        }
        const rows = abcAnalysis(Array.from(sales, ([product, revenue]) => ({ product, revenue }))).map((r) => ({ ...r, name: info.get(r.product)?.name ?? "", sku: info.get(r.product)?.sku ?? "" }));
        return NextResponse.json({ rows });
    }

    return badRequest("kind must be one of: on-hand, date, turnover, card, dead, abc");
}
