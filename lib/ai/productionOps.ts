import { ProviderError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { bomIndex, launchProductionOrder, produceOutput } from "@/lib/finance/productionOrders";
import { mrpRequirements } from "@/lib/finance/production";
import { stockOnHand, type MovementLike } from "@/lib/finance/warehouse";

// Производство для Айрис: спецификации (BOM), потребность в материалах (MRP), поиск производственных заказов и склада.
// Сами заказы создаются/запускаются/выпускаются существующим кодом (lib/finance/productionOrders.ts) — здесь только то, что нужно ассистенту сверху.

/** Склад по названию или id; без аргумента — склад по умолчанию (первый неархивный). null — складов нет вообще. */
export async function resolveWarehouse(org: string, ref?: string): Promise<{ id: string; name: string } | null> {
    const r = String(ref ?? "").trim();
    if (r) {
        const hit = await prisma.warehouse.findFirst({ where: { org, archived: false, OR: [{ id: r }, { name: { contains: r, mode: "insensitive" } }] } });
        if (!hit) throw new ProviderError(`Warehouse "${r}" not found`);
        return { id: hit.id, name: hit.name };
    }
    const def = (await prisma.warehouse.findFirst({ where: { org, archived: false, isDefault: true } })) ?? (await prisma.warehouse.findFirst({ where: { org, archived: false } }));
    return def ? { id: def.id, name: def.name } : null;
}

export interface BomInput {
    product: string; // id изделия
    name?: string;
    components: { product: string; qty: number; wastePercent?: number }[];
    operations?: { name: string; minutes: number; costPerHour: number }[];
    overheadPercent?: number;
    note?: string;
}

/** Сохраняет спецификацию новой версией (как экран «Производство»): старые заказы продолжают считаться по своей версии. */
export async function saveBom(org: string, input: BomInput) {
    if (!input.components.length && !(input.operations ?? []).length) throw new ProviderError("The specification is empty — give the materials (components) of the product");
    if (input.components.some((c) => c.product === input.product)) throw new ProviderError("A product cannot be a component of itself");
    const latest = await prisma.bom.findFirst({ where: { org, product: input.product }, orderBy: { version: "desc" } });
    const version = latest ? (Number(latest.version) || 1) + 1 : 1;
    return prisma.bom.create({
        data: {
            org, product: input.product, version, active: true, name: String(input.name ?? "").slice(0, 120), note: String(input.note ?? "").slice(0, 400),
            overheadPercent: Math.max(0, Math.min(500, Number(input.overheadPercent) || 0)),
            components: input.components.map((c) => ({ product: c.product, qty: Math.abs(Number(c.qty)), wastePercent: Math.max(0, Math.min(100, Number(c.wastePercent) || 0)), optional: false, note: "" })) as never,
            operations: (input.operations ?? []).filter((o) => o.name?.trim()).map((o) => ({ name: String(o.name).slice(0, 120), minutes: Math.max(0, Number(o.minutes) || 0), costPerHour: Math.max(0, Number(o.costPerHour) || 0), workCenter: "" })) as never,
            outputs: [] as never,
        },
    });
}

/** Производственный заказ по номеру: «ВЗ-2026-3», «2026-3» или просто «3» (если открытый заказ один с таким номером). */
export async function findProductionOrder(org: string, ref: string) {
    const r = String(ref ?? "").trim();
    const m = r.match(/(\d{4})\D+(\d+)\s*$/) ?? r.match(/()(\d+)\s*$/);
    if (!m) throw new ProviderError("Give the production order number, e.g. ВЗ-2026-3");
    const tail = m[1] ? `${m[1]}-${m[2]}` : `-${m[2]}`;
    const rows = await prisma.productionOrder.findMany({ where: { org, number: { endsWith: tail } }, orderBy: { createdAt: "desc" }, take: 5 });
    if (!rows.length) throw new ProviderError(`Production order "${r}" not found`);
    if (rows.length > 1) throw new ProviderError(`Several production orders match "${r}": ${rows.map((o) => o.number).join(", ")}`);
    return rows[0];
}

/** Потребность в материалах под открытые заказы: что нужно, сколько на складе, сколько докупить. */
export async function mrpNeeds(org: string) {
    const open = await prisma.productionOrder.findMany({ where: { org, status: { in: ["plan", "launched"] } } });
    const boms = await bomIndex(org);
    const orders = open.map((o) => ({ product: String(o.product), qty: Math.max(0, (Number(o.planQty) || 0) - (Number(o.producedQty) || 0)), due: o.due ?? "" }));
    const movements = await prisma.stockMovement.findMany({ where: { org }, select: { product: true, qty: true, reason: true, warehouse: true, unitCost: true, createdAt: true } });
    const list: MovementLike[] = movements.map((m) => ({ product: String(m.product), qty: m.qty, reason: String(m.reason), unitCost: m.unitCost ?? 0, at: (m.createdAt ?? new Date()).toISOString() }));
    const rows = mrpRequirements(orders, new Map(), boms).map((r) => ({ ...r, inStock: stockOnHand(list, r.product), toBuy: Math.max(0, Math.round((r.required - stockOnHand(list, r.product)) * 10000) / 10000) }));
    const products = rows.length ? await prisma.product.findMany({ where: { id: { in: rows.map((r) => r.product) }, org }, select: { id: true, name: true, unit: true } }) : [];
    const info = new Map(products.map((p) => [p.id, p]));
    return { openOrders: open.length, rows: rows.map((r) => ({ product: info.get(r.product)?.name ?? r.product, unit: info.get(r.product)?.unit ?? "", required: r.required, inStock: r.inStock, toBuy: r.toBuy })) };
}

/** Обзор для чтения: спецификации, заказы, потребность. */
export async function describeProduction(org: string, what: "all" | "boms" | "orders" | "needs" = "all", limit = 30) {
    const out: Record<string, unknown> = {};
    const names = async (ids: string[]) => new Map((ids.length ? await prisma.product.findMany({ where: { id: { in: ids }, org }, select: { id: true, name: true, unit: true } }) : []).map((p) => [p.id, p]));
    if (what === "all" || what === "boms") {
        const boms = await prisma.bom.findMany({ where: { org, active: true }, orderBy: { updatedAt: "desc" }, take: limit });
        const ids = Array.from(new Set(boms.flatMap((b) => [String(b.product), ...(((b.components as { product: unknown }[]) ?? []).map((c) => String(c.product)))])));
        const info = await names(ids);
        out.specifications = boms.map((b) => ({ product: info.get(String(b.product))?.name ?? String(b.product), version: b.version, components: ((b.components as { product: unknown; qty: number; wastePercent?: number }[]) ?? []).map((c) => `${info.get(String(c.product))?.name ?? c.product} × ${c.qty}${c.wastePercent ? ` (+${c.wastePercent}% waste)` : ""}`), operations: ((b.operations as { name: string; minutes: number }[]) ?? []).map((o) => `${o.name} ${o.minutes} min`) }));
    }
    if (what === "all" || what === "orders") {
        const orders = await prisma.productionOrder.findMany({ where: { org }, orderBy: { createdAt: "desc" }, take: limit });
        const info = await names(Array.from(new Set(orders.map((o) => String(o.product)))));
        out.orders = orders.map((o) => ({ number: o.number, product: info.get(String(o.product))?.name ?? String(o.product), status: o.status, planned: o.planQty, produced: o.producedQty, scrap: o.scrapQty, due: o.due || undefined }));
    }
    if (what === "all" || what === "needs") out.needs = await mrpNeeds(org);
    return out;
}

type OrderLike = { id: string; number: string; status: string; planQty: unknown; producedQty: unknown; materials: unknown };

/** Чего не хватает на складе под материалы заказа (с учётом уже зарезервированного для него). */
export async function missingMaterials(org: string, order: OrderLike): Promise<string[]> {
    if (order.status !== "plan") return []; // у запущенного заказа материалы уже в резерве
    const missing: string[] = [];
    for (const m of (order.materials as { product: unknown; qty: number }[]) ?? []) {
        const card = await prisma.product.findFirst({ where: { id: String(m.product), org }, select: { name: true, stockQty: true } });
        if ((card?.stockQty ?? 0) < m.qty) missing.push(`${card?.name ?? m.product}: need ${m.qty}, have ${card?.stockQty ?? 0}`);
    }
    return missing;
}

/** Доводит заказ до конца: запускает (если ещё плановый) и выпускает весь остаток плана. Не хватает материалов — ничего не трогает и возвращает список. */
export async function completeOrder(org: string, order: OrderLike, by: string): Promise<{ done: true; portion: number; unitCost: number } | { done: false; missing: string[] }> {
    const missing = await missingMaterials(org, order);
    if (missing.length) return { done: false, missing };
    if (order.status === "plan") await launchProductionOrder(org, order.id);
    const left = Math.max(0, (Number(order.planQty) || 0) - (Number(order.producedQty) || 0));
    const r = await produceOutput(org, order.id, { qty: left, by });
    return { done: true, portion: r.portion, unitCost: r.unitCost };
}

/** Стирает товары из базы насовсем вместе с их историей: движения по складу, производственные заказы и спецификации, где товар — изделие или материал.
 *  ids = null — вся номенклатура фирмы (включая архивную). Счета, КП, заказы клиентов и закупки не трогает: в них название и цена записаны строкой. */
export async function eraseProducts(org: string, ids: string[] | null) {
    return prisma.$transaction(async (tx) => {
        const scope = ids ? { in: ids } : undefined;
        const boms = await tx.bom.findMany({ where: { org } });
        const hit = new Set(ids ?? []);
        const bomIds = boms.filter((b) => !ids || hit.has(String(b.product)) || ((b.components as { product: unknown }[]) ?? []).some((c) => hit.has(String(c.product)))).map((b) => b.id);
        const orders = (await tx.productionOrder.deleteMany({ where: { org, ...(scope ? { product: scope } : {}) } })).count;
        if (bomIds.length) await tx.bom.deleteMany({ where: { org, id: { in: bomIds } } });
        const movements = (await tx.stockMovement.deleteMany({ where: { org, ...(scope ? { product: scope } : {}) } })).count;
        if (!ids) await tx.stockDoc.deleteMany({ where: { org } });
        const products = (await tx.product.deleteMany({ where: { org, ...(scope ? { id: scope } : {}) } })).count;
        if (!ids) {
            // вся номенклатура стёрта — нумерация производственных заказов начинается заново
            const fs = await tx.financeSettings.findUnique({ where: { org } });
            if (fs) {
                const counters = { ...((fs.counters as Record<string, number> | null) ?? {}) };
                for (const k of Object.keys(counters)) if (k.startsWith("ВЗ-")) delete counters[k];
                await tx.financeSettings.update({ where: { org }, data: { counters } });
            }
        }
        return { products, movements, orders, specs: bomIds.length };
    }, { timeout: 60000 });
}
