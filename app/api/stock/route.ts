import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { toCsv } from "@/lib/import/csv";
import { abcAnalysis, deadStock, stockAt, stockByWarehouse, stockOnHand, turnover, type MovementLike } from "@/lib/finance/warehouse";
import { prisma } from "@/lib/prisma";

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

    // Свежие движения важнее старых: берём последние 20 000 и разворачиваем в хронологический порядок.
    const movements = await prisma.stockMovement.findMany({ where: { org: user.id }, orderBy: { createdAt: "desc" }, take: 20000 });
    movements.reverse();
    const list: MovementLike[] = movements.map((m) => ({
        product: m.product,
        warehouse: m.warehouse ?? null,
        qty: m.qty,
        reason: m.reason,
        unitCost: m.unitCost ?? 0,
        at: (m.createdAt ?? new Date()).toISOString(),
    }));
    const products = await prisma.product.findMany({ where: { org: user.id }, select: { id: true, name: true, sku: true, barcode: true, unit: true, stockQty: true, reorderLevel: true, purchasePrice: true, salePrice: true, type: true, image: true , archived: true } });
    const info = new Map(products.map((p) => [p.id, p]));
    // Архивные товары (удалённые из каталога) в остатках не показываем: движения по ним остаются для истории и оборотов
    const live = products.filter((p) => !p.archived);

    if (kind === "on-hand") {
        // Остатки по складам: сумма движений по каждому складу, не кэш поля
        const warehouses = await prisma.warehouse.findMany({ where: { org: user.id }, select: { id: true, name: true } });
        const by = stockByWarehouse(list);
        const rows = live
            .filter((p) => p.type === "good")
            .map((p) => {
                const id = p.id;
                const total = stockOnHand(list, id);
                const byWh = Object.fromEntries(warehouses.map((w) => [w.id, by[w.id]?.[id] ?? 0]));
                const placed = Object.values(byWh).reduce((s, v) => s + (Number(v) || 0), 0);
                return {
                    id,
                    name: p.name,
                    sku: p.sku ?? "",
                    barcode: p.barcode ?? "",
                    unit: p.unit ?? "",
                    total,
                    byWarehouse: byWh,
                    // Остаток «без складу»: старые движения без склада и резервы заказов.
                    noWarehouse: Math.round((total - placed) * 1000) / 1000,
                    reorderLevel: p.reorderLevel ?? 0,
                    image: p.image ?? "",
                };
            });
        if ((url.searchParams.get("format") ?? "json").toLowerCase() === "csv") {
            const columns = ["sku", "barcode", "name", "unit", ...warehouses.map((w) => w.name), "noWarehouse", "total", "reorderLevel"];
            const csvRows = rows.map((r) => [r.sku, r.barcode, r.name, r.unit, ...warehouses.map((w) => r.byWarehouse[w.id] ?? 0), r.noWarehouse, r.total, r.reorderLevel]);
            return new Response(toCsv(columns, csvRows), {
                headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="stock-on-hand.csv"`, "Cache-Control": "no-store" },
            });
        }
        return NextResponse.json({ warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })), rows });
    }

    if (kind === "date") {
        const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
        return NextResponse.json({
            date,
            rows: live
                .filter((p) => p.type === "good")
                .map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? "", qty: stockAt(list, date, p.id) }))
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
            .filter((m) => m.product === product)
            .map((m) => ({ at: (m.createdAt ?? new Date()).toISOString(), qty: m.qty, reason: m.reason, unitCost: m.unitCost ?? 0, note: m.note ?? "" }));
        return NextResponse.json({ product: info.get(product)?.name ?? "", unit: info.get(product)?.unit ?? "", onHand: stockOnHand(list, product), rows });
    }

    if (kind === "dead") {
        const days = Math.max(30, Number(url.searchParams.get("days")) || 90);
        const today = new Date().toISOString().slice(0, 10);
        return NextResponse.json({ days, rows: deadStock(list, today, days).filter((id) => info.get(id) && !info.get(id)!.archived).map((id) => ({ id, name: info.get(id)?.name ?? "", qty: stockOnHand(list, id) })) });
    }

    if (kind === "abc") {
        // Выручка по товарам — из движений продаж: цена продажи берётся из карточки товара
        const sales = new Map<string, number>();
        for (const m of movements) {
            if (m.reason !== "sale" && m.reason !== "issue") continue;
            const price = Number(info.get(m.product)?.salePrice) || m.unitCost || 0;
            sales.set(m.product, (sales.get(m.product) ?? 0) + Math.abs(m.qty) * price);
        }
        const rows = abcAnalysis(Array.from(sales, ([product, revenue]) => ({ product, revenue }))).map((r) => ({ ...r, name: info.get(r.product)?.name ?? "", sku: info.get(r.product)?.sku ?? "" }));
        return NextResponse.json({ rows });
    }

    return badRequest("kind must be one of: on-hand, date, turnover, card, dead, abc");
}
