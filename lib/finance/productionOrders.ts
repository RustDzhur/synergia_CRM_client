import { ProviderError } from "@/lib/http";
import { validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { nextNumber } from "./numbering";
import { explodeBom, productionCost, unitCostOf, type BomLike } from "./production";
import { moveStock, releaseForOrder, reserveForOrder } from "./stock";

// Производственные заказы (ТЗ §13): план → запуск (резерв материалов) → выпуск.
//
// Себестоимость собирается по факту: материалы — по средней цене приходов, труд — по фактическому
// времени, накладные — процентом от труда. Выпущенная продукция приходуется на склад с этой
// себестоимостью, поэтому продажа потом считается по настоящей цене производства, а не по нулю.

/** Карта активных спецификаций: товар → BOM (последняя версия). */
export async function bomIndex(org: string): Promise<Map<string, BomLike & { id: string; overheadPercent: number }>> {
    const list = await prisma.bom.findMany({ where: { org, active: true }, orderBy: { version: "asc" } });
    const map = new Map<string, BomLike & { id: string; overheadPercent: number }>();
    for (const b of list) {
        // Побеждает последняя версия: сортировка по version и перезапись
        map.set(String(b.product), {
            id: b.id,
            product: String(b.product),
            components: ((b.components as any[]) ?? []).map((c: { product: unknown; qty: number; wastePercent?: number; optional?: boolean }) => ({ product: String(c.product), qty: c.qty, wastePercent: c.wastePercent, optional: c.optional })),
            operations: ((b.operations as any[]) ?? []).map((o: { name: string; minutes: number; costPerHour: number; workCenter?: string }) => ({ name: o.name, minutes: o.minutes, costPerHour: o.costPerHour, workCenter: o.workCenter })),
            outputs: ((b.outputs as any[]) ?? []).map((o: { product: unknown; qty: number }) => ({ product: String(o.product), qty: o.qty })),
            overheadPercent: Number(b.overheadPercent) || 0,
        });
    }
    return map;
}

/** Средняя себестоимость товара по приходам — по ней материалы списываются в производство. */
async function averageCosts(org: string, products: string[]): Promise<Map<string, number>> {
    const movements = await prisma.stockMovement.findMany({ where: { org, product: { in: products }, qty: { gt: 0 } }, select: { product: true, qty: true, unitCost: true } });
    const acc = new Map<string, { qty: number; value: number }>();
    for (const m of movements) {
        const key = String(m.product);
        const prev = acc.get(key) ?? { qty: 0, value: 0 };
        prev.qty += Number(m.qty) || 0;
        prev.value += (Number(m.qty) || 0) * (Number(m.unitCost) || 0);
        acc.set(key, prev);
    }
    return new Map(Array.from(acc, ([p, a]) => [p, a.qty ? Math.round((a.value / a.qty) * 10000) / 10000 : 0]));
}

export interface CreateProductionInput {
    product: string;
    qty: number;
    bomId?: string;
    warehouseMaterials?: string;
    warehouseOutput?: string;
    due?: string;
    note?: string;
    by?: string;
}

/** Склад по умолчанию для заказа: явно выбранный или первый склад фирмы; без складов выпуск невозможен. */
async function fallbackWarehouse(org: string, preferred?: string): Promise<string> {
    if (preferred && validId(preferred)) return preferred;
    const def = await prisma.warehouse.findFirst({ where: { org, archived: false }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true } });
    if (!def) throw new ProviderError("Створіть хоча б один склад — випуск і списання матеріалів проводяться через нього");
    return def.id;
}

/** Создание заказа: взрыв состава и план себестоимости (материалы по средней, труд по норме). */
export async function createProductionOrder(org: string, input: CreateProductionInput) {
    const qty = Number(input.qty) || 0;
    if (!input.product || qty <= 0) throw new ProviderError("Вкажіть виріб і кількість");
    const index = await bomIndex(org);
    const bom = index.get(String(input.product));
    if (!bom) throw new ProviderError("Для цього виробу немає специфікації — спершу складіть склад");

    const explosion = explodeBom(String(input.product), qty, index);
    if (explosion.cycles.length) throw new ProviderError("Специфікації зациклені: " + explosion.cycles.join(", "));
    const costs = await averageCosts(org, explosion.materials.map((m) => m.product));
    const materialLines = explosion.materials.map((m) => ({ product: m.product, qty: m.qty, usedQty: 0, unitCost: costs.get(m.product) ?? 0 }));
    const plan = productionCost({
        materials: materialLines.map((m) => ({ qty: m.qty, unitCost: m.unitCost })),
        operations: explosion.operations,
        overheadPercent: bom.overheadPercent,
    });

    // Изделие и компоненты обязаны быть товарами (type "good"): у услуги нет остатка, и выпуск
    // молча ничего бы не приходовал.
    const ids = [String(input.product), ...materialLines.map((m) => m.product)];
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, org }, select: { id: true, name: true, type: true } });
    const service = rows.find((p) => p.type !== "good");
    if (service) throw new ProviderError(`«${service.name}» у картці має тип «Послуга» — у послуги немає складу. Відкрийте картку товару і змініть тип на «Товар»`);
    if (rows.length !== new Set(ids).size) throw new ProviderError("Деякі товари замовлення не знайдено");

    const product = rows.find((p) => p.id === String(input.product));
    if (!product) throw new ProviderError("Виріб не знайдено");
    // Склад обязателен: без него движения уходили бы в «ничей» склад
    const warehouseMaterials = await fallbackWarehouse(org, input.warehouseMaterials);
    const warehouseOutput = await fallbackWarehouse(org, input.warehouseOutput);
    const number = await nextNumber(org, "ВЗ");
    const order = await prisma.productionOrder.create({
        data: {
            org,
            number,
            bom: bom.id,
            product: input.product,
            planQty: qty,
            status: "plan",
            warehouseMaterials,
            warehouseOutput,
            materials: materialLines as any,
            operations: explosion.operations.map((o) => ({ name: o.name, minutes: o.minutes, actualMinutes: 0, costPerHour: o.costPerHour, workCenter: o.workCenter })) as any,
            planCost: plan.total,
            due: input.due ?? "",
            note: input.note ?? "",
            createdByName: input.by ?? "",
        },
    });
    return order;
}

/** Запуск: материалы резервируются на складе — их нельзя потратить на другое. */
export async function launchProductionOrder(org: string, id: string) {
    const order = await prisma.productionOrder.findFirst({ where: { id, org } });
    if (!order) throw new ProviderError("Замовлення не знайдено");
    if (order.status !== "plan") throw new ProviderError("Запустити можна лише заплановане замовлення");
    await reserveForOrder(org, order.id, ((order.materials as any[]) ?? []).map((m: { product: unknown; qty: number }) => ({ product: String(m.product), qty: m.qty })), order.createdByName ?? "");
    return prisma.productionOrder.update({ where: { id: order.id }, data: { status: "launched" } });
}

export interface OutputInput {
    qty: number;
    scrapQty?: number;
    actualMinutes?: number;
    by?: string;
}

/** Выпуск: списание материалов и приход продукции по фактической себестоимости. */
export async function produceOutput(org: string, id: string, input: OutputInput) {
    const order = await prisma.productionOrder.findFirst({ where: { id, org } });
    if (!order) throw new ProviderError("Замовлення не знайдено");
    if (order.status === "plan") throw new ProviderError("Спершу запустіть замовлення — матеріали мають бути зарезервовані");
    if (order.status === "done") throw new ProviderError("Замовлення вже завершено");
    const qty = Number(input.qty) || 0;
    if (qty <= 0) throw new ProviderError("Вкажіть кількість випуску");
    const left = Number(order.planQty) - Number(order.producedQty);
    const portion = Math.min(qty, left);
    if (portion <= 0) throw new ProviderError("План уже виконано — випускати більше нічого");
    const factor = portion / (Number(order.planQty) || 1);

    // Материалы: снимаем резерв на долю выпуска и списываем её в производство.
    const materialLines = ((order.materials as any[]) ?? []) as Array<{ product: unknown; qty: number; usedQty?: number; unitCost?: number }>;
    const usePortion = materialLines.map((m) => ({ product: String(m.product), qty: Math.round(m.qty * factor * 10000) / 10000 }));
    const materialIds = Array.from(new Set(usePortion.map((u) => u.product)));
    const materialCards = await prisma.product.findMany({ where: { id: { in: materialIds }, org }, select: { id: true, name: true, type: true } });
    const notGood = materialCards.find((p) => p.type !== "good");
    if (notGood || materialCards.length !== materialIds.length) {
        throw new ProviderError(`Матеріал «${notGood?.name ?? "?"}» має тип «Послуга» або не існує — списати в виробництво нічого. Перевірте картки товарів`);
    }
    await releaseForOrder(org, order.id, usePortion, order.createdByName ?? "");
    for (const line of usePortion) {
        const moved = await moveStock(org, line.product, -Math.abs(line.qty), "writeoff", {
            warehouse: order.warehouseMaterials ? String(order.warehouseMaterials) : null,
            unitCost: materialLines.find((m) => String(m.product) === line.product)?.unitCost ?? 0,
            note: `Списання у виробництво ${order.number}`,
            by: input.by ?? "",
        });
        if (!moved) throw new ProviderError("Матеріал у складі замовлення має тип «Послуга» або нульову кількість — склад не змінився. Перевірте картки товарів");
    }
    for (const m of materialLines) m.usedQty = Math.round(((Number(m.usedQty) || 0) + Math.round(m.qty * factor * 10000) / 10000) * 10000) / 10000;

    // Труд: фактические минуты распределяются по операциям пропорционально норме
    const operations = ((order.operations as any[]) ?? []) as Array<{ name: string; minutes: number; actualMinutes?: number; costPerHour: number }>;
    const totalPlanMinutes = operations.reduce((s, o) => s + (Number(o.minutes) || 0), 0) || 1;
    const actual = Number(input.actualMinutes) || 0;
    if (actual > 0) {
        for (const op of operations) op.actualMinutes = Math.round(((Number(op.actualMinutes) || 0) + (actual * ((Number(op.minutes) || 0) / totalPlanMinutes))) * 100) / 100;
    } else {
        for (const op of operations) op.actualMinutes = Math.round(((Number(op.actualMinutes) || 0) + (Number(op.minutes) || 0) * factor) * 100) / 100;
    }

    // Себестоимость выпущенной части: материалы по их цене в заказе, труд по факту, накладные процентом
    const bom = await prisma.bom.findFirst({ where: { id: order.bom, org }, select: { overheadPercent: true, outputs: true, product: true } });
    const overheadPercent = Number(bom?.overheadPercent) || 0;
    const cost = productionCost({
        materials: usePortion.map((u) => ({ qty: Math.abs(u.qty), unitCost: materialLines.find((m) => String(m.product) === u.product)?.unitCost ?? 0 })),
        operations: operations.map((o) => ({ minutes: Number(o.actualMinutes) || 0, costPerHour: Number(o.costPerHour) || 0 })),
        overheadPercent,
    });
    const unitCost = unitCostOf(cost, portion);

    // Выпуск на склад: основное изделие и побочная продукция (по доле выпуска).
    const outputWarehouse = order.warehouseOutput ? String(order.warehouseOutput) : await fallbackWarehouse(org);
    const produced = await moveStock(org, String(order.product), portion, "purchase", {
        warehouse: outputWarehouse,
        unitCost,
        note: `Випуск за замовленням ${order.number}`,
        by: input.by ?? "",
    });
    if (!produced) {
        const p = await prisma.product.findFirst({ where: { id: order.product, org }, select: { name: true, type: true } });
        throw new ProviderError(`Не вдалося оприбуткувати «${p?.name ?? "виріб"}»: у картці тип «Послуга» — у послуги немає складу. Змініть тип на «Товар» і повторіть випуск`);
    }
    const stockQty = portion - (Number(input.scrapQty) || 0);
    for (const out of (bom?.outputs as any[]) ?? []) {
        const outQty = Math.round(((Number(out.qty) || 0) * factor) * 10000) / 10000;
        if (outQty <= 0) continue;
        await moveStock(org, String(out.product), outQty, "surplus", {
            warehouse: outputWarehouse,
            unitCost: 0,
            note: `Побічна продукція за ${order.number}`,
            by: input.by ?? "",
        });
    }
    // Брак остаётся выпущенным (его себестоимость уже в партии) и помечается количеством
    const producedQty = Number(order.producedQty) + portion;
    const scrapQty = Number(order.scrapQty) + Math.max(0, Number(input.scrapQty) || 0);
    // Итоговые затраты заказа копятся по фактическим выпускам
    const prev = (order.costs as any) ?? { materials: 0, labor: 0, overhead: 0, total: 0 };
    const costs = {
        materials: Math.round(((Number(prev.materials) || 0) + cost.materials) * 100) / 100,
        labor: Math.round(((Number(prev.labor) || 0) + cost.labor) * 100) / 100,
        overhead: Math.round(((Number(prev.overhead) || 0) + cost.overhead) * 100) / 100,
        total: 0,
    };
    costs.total = Math.round((costs.materials + costs.labor + costs.overhead) * 100) / 100;
    const updated = await prisma.productionOrder.update({
        where: { id: order.id },
        data: {
            materials: materialLines as any,
            operations: operations as any,
            costs: costs as any,
            producedQty,
            scrapQty,
            status: producedQty >= Number(order.planQty) ? "done" : "launched",
        },
    });
    return { order: updated, portion, unitCost, cost, stockQty };
}

/** Отмена: зарезервированное возвращается на склад, заказ закрывается. */
export async function cancelProductionOrder(org: string, id: string) {
    const order = await prisma.productionOrder.findFirst({ where: { id, org } });
    if (!order) throw new ProviderError("Замовлення не знайдено");
    if (order.status === "done") throw new ProviderError("Завершене замовлення не скасовують");
    if (order.status === "launched") {
        // Возвращаем остаток резерва: план минус уже списанное
        const rest = ((order.materials as any[]) ?? []).map((m: { product: unknown; qty: number; usedQty?: number }) => ({ product: String(m.product), qty: Math.max(0, (Number(m.qty) || 0) - (Number(m.usedQty) || 0)) }));
        const stockSum = rest.reduce((s: number, r: { qty: number }) => s + r.qty, 0);
        if (stockSum > 0) await releaseForOrder(org, order.id, rest, order.createdByName ?? "");
    }
    return prisma.productionOrder.update({ where: { id: order.id }, data: { status: "cancelled" } });
}
