import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { toCsv } from "@/lib/import/csv";
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

    // Свежие движения важнее старых: раньше сортировка по возрастанию с лимитом 20 000 брала САМЫЕ
    // СТАРЫЕ движения, и у фирмы с большой историей новые выпуски/перемещения не попадали в остатки
    // и отчёты вовсе. Берём последние 20 000 и разворачиваем в хронологический порядок для расчётов.
    const movements = await StockMovement.find({ org: user.id }).sort({ createdAt: -1 }).limit(20000);
    movements.reverse();
    const list: MovementLike[] = movements.map((m) => ({
        product: String(m.product),
        warehouse: m.warehouse ? String(m.warehouse) : null,
        qty: m.qty,
        reason: String(m.reason),
        unitCost: m.unitCost ?? 0,
        at: (m.createdAt ?? new Date()).toISOString(),
    }));
    const products = await Product.find({ org: user.id }).select("name sku barcode unit stockQty reorderLevel purchasePrice salePrice type image");
    const info = new Map(products.map((p) => [String(p._id), p]));

    if (kind === "on-hand") {
        // Остатки по складам: сумма движений по каждому складу, не кэш поля
        const warehouses = await Warehouse.find({ org: user.id }).select("name");
        const by = stockByWarehouse(list);
        const rows = products
            .filter((p) => p.type === "good")
            .map((p) => {
                const id = String(p._id);
                const total = stockOnHand(list, id);
                const byWh = Object.fromEntries(warehouses.map((w) => [String(w._id), by[String(w._id)]?.[id] ?? 0]));
                const placed = Object.values(byWh).reduce((s, v) => s + (Number(v) || 0), 0);
                return {
                    id,
                    name: p.name,
                    sku: p.sku ?? "",
                    barcode: p.barcode ?? "",
                    unit: p.unit ?? "",
                    total,
                    byWarehouse: byWh,
                    // Остаток «без складу»: старые движения без склада и резервы заказов. Без этой колонки
                    // «Разом» не сходилось с суммой складов и выглядело ошибкой
                    noWarehouse: Math.round((total - placed) * 1000) / 1000,
                    reorderLevel: p.reorderLevel ?? 0,
                    image: p.image ?? "",
                };
            });
        // Остатки файлом: кнопка «Експорт залишків» обещала CSV, а отдавала JSON — теперь форматов два,
        // по умолчанию по-прежнему JSON (его читает мастер импорта), CSV — для таблиц и сверок
        if ((url.searchParams.get("format") ?? "json").toLowerCase() === "csv") {
            const columns = ["sku", "barcode", "name", "unit", ...warehouses.map((w) => w.name), "noWarehouse", "total", "reorderLevel"];
            const csvRows = rows.map((r) => [r.sku, r.barcode, r.name, r.unit, ...warehouses.map((w) => r.byWarehouse[String(w._id)] ?? 0), r.noWarehouse, r.total, r.reorderLevel]);
            return new Response(toCsv(columns, csvRows), {
                headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="stock-on-hand.csv"`, "Cache-Control": "no-store" },
            });
        }
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
