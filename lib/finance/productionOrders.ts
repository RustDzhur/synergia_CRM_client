import { Types } from "mongoose";
import { ProviderError } from "@/lib/http";
import { nextNumber } from "./numbering";
import { explodeBom, productionCost, unitCostOf, type BomLike } from "./production";
import { moveStock, releaseForOrder, reserveForOrder } from "./stock";
import Bom from "@/models/Bom";
import Product from "@/models/Product";
import ProductionOrder from "@/models/ProductionOrder";
import StockMovement from "@/models/StockMovement";
import Warehouse from "@/models/Warehouse";

// Производственные заказы (ТЗ §13): план → запуск (резерв материалов) → выпуск.
//
// Себестоимость собирается по факту: материалы — по средней цене приходов, труд — по фактическому
// времени, накладные — процентом от труда. Выпущенная продукция приходуется на склад с этой
// себестоимостью, поэтому продажа потом считается по настоящей цене производства, а не по нулю.

/** Карта активных спецификаций: товар → BOM (последняя версия). */
export async function bomIndex(org: string): Promise<Map<string, BomLike & { id: string; overheadPercent: number }>> {
    const list = await Bom.find({ org, active: true }).sort({ version: 1 });
    const map = new Map<string, BomLike & { id: string; overheadPercent: number }>();
    for (const b of list) {
        // Побеждает последняя версия: сортировка по version и перезапись
        map.set(String(b.product), {
            id: String(b._id),
            product: String(b.product),
            components: (b.components ?? []).map((c: { product: unknown; qty: number; wastePercent?: number; optional?: boolean }) => ({ product: String(c.product), qty: c.qty, wastePercent: c.wastePercent, optional: c.optional })),
            operations: (b.operations ?? []).map((o: { name: string; minutes: number; costPerHour: number; workCenter?: string }) => ({ name: o.name, minutes: o.minutes, costPerHour: o.costPerHour, workCenter: o.workCenter })),
            outputs: (b.outputs ?? []).map((o: { product: unknown; qty: number }) => ({ product: String(o.product), qty: o.qty })),
            overheadPercent: Number(b.overheadPercent) || 0,
        });
    }
    return map;
}

/** Средняя себестоимость товара по приходам — по ней материалы списываются в производство. */
async function averageCosts(org: string, products: string[]): Promise<Map<string, number>> {
    const movements = await StockMovement.find({ org, product: { $in: products }, qty: { $gt: 0 } }).select("product qty unitCost");
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
    if (preferred && Types.ObjectId.isValid(preferred)) return preferred;
    const def = await Warehouse.findOne({ org, archived: { $ne: true } }).sort({ isDefault: -1, createdAt: 1 }).select("_id");
    if (!def) throw new ProviderError("Створіть хоча б один склад — випуск і списання матеріалів проводяться через нього");
    return String(def._id);
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
    // молча ничего бы не приходовал — «будка выпущена, а на складе её нет» начиналось именно так
    const ids = [String(input.product), ...materialLines.map((m) => m.product)];
    const rows = await Product.find({ _id: { $in: ids }, org }).select("name type");
    const service = rows.find((p) => p.type !== "good");
    if (service) throw new ProviderError(`«${service.name}» у картці має тип «Послуга» — у послуги немає складу. Відкрийте картку товару і змініть тип на «Товар»`);
    if (rows.length !== new Set(ids).size) throw new ProviderError("Деякі товари замовлення не знайдено");

    const product = rows.find((p) => String(p._id) === String(input.product));
    if (!product) throw new ProviderError("Виріб не знайдено");
    // Склад обязателен: без него движения уходили бы в «ничей» склад и не попадали ни в одну колонку отчёта
    const warehouseMaterials = await fallbackWarehouse(org, input.warehouseMaterials);
    const warehouseOutput = await fallbackWarehouse(org, input.warehouseOutput);
    const number = await nextNumber(org, "ВЗ");
    const order = await ProductionOrder.create({
        org,
        number,
        bom: bom.id,
        product: input.product,
        planQty: qty,
        status: "plan",
        warehouseMaterials,
        warehouseOutput,
        materials: materialLines,
        operations: explosion.operations.map((o) => ({ name: o.name, minutes: o.minutes, actualMinutes: 0, costPerHour: o.costPerHour, workCenter: o.workCenter })),
        planCost: plan.total,
        due: input.due ?? "",
        note: input.note ?? "",
        createdByName: input.by ?? "",
    });
    return order;
}

/** Запуск: материалы резервируются на складе — их нельзя потратить на другое. */
export async function launchProductionOrder(org: string, id: string) {
    const order = await ProductionOrder.findOne({ _id: id, org });
    if (!order) throw new ProviderError("Замовлення не знайдено");
    if (order.status !== "plan") throw new ProviderError("Запустити можна лише заплановане замовлення");
    await reserveForOrder(org, String(order._id), (order.materials ?? []).map((m: { product: unknown; qty: number }) => ({ product: String(m.product), qty: m.qty })), order.createdByName ?? "");
    order.status = "launched";
    await order.save();
    return order;
}

export interface OutputInput {
    qty: number; // сколько выпускаем сейчас
    scrapQty?: number; // из них брак
    actualMinutes?: number; // фактическое время по операциям (суммарно)
    by?: string;
}

/** Выпуск: списание материалов и приход продукции по фактической себестоимости. */
export async function produceOutput(org: string, id: string, input: OutputInput) {
    const order = await ProductionOrder.findOne({ _id: id, org });
    if (!order) throw new ProviderError("Замовлення не знайдено");
    if (order.status === "plan") throw new ProviderError("Спершу запустіть замовлення — матеріали мають бути зарезервовані");
    if (order.status === "done") throw new ProviderError("Замовлення вже завершено");
    const qty = Number(input.qty) || 0;
    if (qty <= 0) throw new ProviderError("Вкажіть кількість випуску");
    const left = Number(order.planQty) - Number(order.producedQty);
    const portion = Math.min(qty, left);
    // Ноль выпускать нечего: раньше такая попытка «проходила успешно», не сделав ни одного движения
    if (portion <= 0) throw new ProviderError("План уже виконано — випускати більше нічого");
    const factor = portion / (Number(order.planQty) || 1);

    // Материалы: снимаем резерв на долю выпуска и списываем её в производство.
    // До движений проверяем, что материалы — товары: молчаливый пропуск движения (услуга в составе)
    // раньше выглядел как успешный выпуск, при котором склад не менялся вовсе
    const materialLines = (order.materials ?? []) as Array<{ product: unknown; qty: number; usedQty?: number; unitCost?: number }>;
    const usePortion = materialLines.map((m) => ({ product: String(m.product), qty: Math.round(m.qty * factor * 10000) / 10000 }));
    const materialIds = Array.from(new Set(usePortion.map((u) => u.product)));
    const materialCards = await Product.find({ _id: { $in: materialIds }, org }).select("name type");
    const notGood = materialCards.find((p) => p.type !== "good");
    if (notGood || materialCards.length !== materialIds.length) {
        throw new ProviderError(`Матеріал «${notGood?.name ?? "?"}» має тип «Послуга» або не існує — списати в виробництво нічого. Перевірте картки товарів`);
    }
    await releaseForOrder(org, String(order._id), usePortion, order.createdByName ?? "");
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
    const operations = (order.operations ?? []) as Array<{ name: string; minutes: number; actualMinutes?: number; costPerHour: number }>;
    const totalPlanMinutes = operations.reduce((s, o) => s + (Number(o.minutes) || 0), 0) || 1;
    const actual = Number(input.actualMinutes) || 0;
    if (actual > 0) {
        for (const op of operations) op.actualMinutes = Math.round(((Number(op.actualMinutes) || 0) + (actual * ((Number(op.minutes) || 0) / totalPlanMinutes))) * 100) / 100;
    } else {
        for (const op of operations) op.actualMinutes = Math.round(((Number(op.actualMinutes) || 0) + (Number(op.minutes) || 0) * factor) * 100) / 100;
    }

    // Себестоимость выпущенной части: материалы по их цене в заказе, труд по факту, накладные процентом
    const bom = await Bom.findOne({ _id: order.bom, org }).select("overheadPercent outputs product");
    const overheadPercent = Number(bom?.overheadPercent) || 0;
    const cost = productionCost({
        materials: usePortion.map((u) => ({ qty: Math.abs(u.qty), unitCost: materialLines.find((m) => String(m.product) === u.product)?.unitCost ?? 0 })),
        operations: operations.map((o) => ({ minutes: Number(o.actualMinutes) || 0, costPerHour: Number(o.costPerHour) || 0 })),
        overheadPercent,
    });
    const unitCost = unitCostOf(cost, portion);

    // Выпуск на склад: основное изделие и побочная продукция (по доле выпуска).
    // Склад выпуска: у старых заказов его могло не быть — подставляем склад по умолчанию,
    // иначе приход уходил бы в «ничей» склад и не был виден ни по одному складу
    const outputWarehouse = order.warehouseOutput ? String(order.warehouseOutput) : await fallbackWarehouse(org);
    const produced = await moveStock(org, String(order.product), portion, "purchase", {
        warehouse: outputWarehouse,
        unitCost,
        note: `Випуск за замовленням ${order.number}`,
        by: input.by ?? "",
    });
    if (!produced) {
        const p = await Product.findOne({ _id: order.product, org }).select("name type");
        throw new ProviderError(`Не вдалося оприбуткувати «${p?.name ?? "виріб"}»: у картці тип «Послуга» — у послуги немає складу. Змініть тип на «Товар» і повторіть випуск`);
    }
    const stockQty = portion - (Number(input.scrapQty) || 0);
    for (const out of bom?.outputs ?? []) {
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
    order.producedQty = Number(order.producedQty) + portion;
    order.scrapQty = Number(order.scrapQty) + Math.max(0, Number(input.scrapQty) || 0);
    order.markModified("materials");
    order.markModified("operations");
    // Итоговые затраты заказа копятся по фактическим выпускам
    const prev = order.costs as unknown as { materials: number; labor: number; overhead: number; total: number };
    prev.materials = Math.round((prev.materials + cost.materials) * 100) / 100;
    prev.labor = Math.round((prev.labor + cost.labor) * 100) / 100;
    prev.overhead = Math.round((prev.overhead + cost.overhead) * 100) / 100;
    prev.total = Math.round((prev.materials + prev.labor + prev.overhead) * 100) / 100;
    order.markModified("costs");
    order.status = Number(order.producedQty) >= Number(order.planQty) ? "done" : "launched";
    await order.save();
    return { order, portion, unitCost, cost, stockQty };
}

/** Отмена: зарезервированное возвращается на склад, заказ закрывается. */
export async function cancelProductionOrder(org: string, id: string) {
    const order = await ProductionOrder.findOne({ _id: id, org });
    if (!order) throw new ProviderError("Замовлення не знайдено");
    if (order.status === "done") throw new ProviderError("Завершене замовлення не скасовують");
    if (order.status === "launched") {
        // Возвращаем остаток резерва: план минус уже списанное
        const rest = (order.materials ?? []).map((m: { product: unknown; qty: number; usedQty?: number }) => ({ product: String(m.product), qty: Math.max(0, (Number(m.qty) || 0) - (Number(m.usedQty) || 0)) }));
        const stockSum = rest.reduce((s: number, r: { qty: number }) => s + r.qty, 0);
        if (stockSum > 0) await releaseForOrder(org, String(order._id), rest, order.createdByName ?? "");
    }
    order.status = "cancelled";
    await order.save();
    return order;
}
