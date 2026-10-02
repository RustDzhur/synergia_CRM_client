import { ProviderError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { validId } from "@/lib/api";
import { nextNumber } from "./numbering";
import { financeSettings } from "./settings";
import { averageCost, stockOnHand, type MovementLike } from "./warehouse";
import { moveStock } from "./stock";

// Документы склада (ТЗ §12): приход, расход, перемещение, списание, оприбуткування излишков,
// инвентаризация. Документ проводит движения — остаток меняется только так, руками не правится.
// Ошибку исправляет сторно: оно повторяет движения с обратным знаком и остаётся в журнале рядом
// с исходным документом, чтобы история читалась как есть.

export type StockDocKind = "receipt" | "issue" | "transfer" | "writeoff" | "surplus" | "inventory";

const PREFIX: Record<StockDocKind, string> = { receipt: "ПРИХ", issue: "ВИД", transfer: "ПЕР", writeoff: "СПИС", surplus: "ЛИШ", inventory: "ІНВ" };

export interface StockDocLine { product: string; qty: number; price?: number; note?: string }

export interface StockDocInput {
    kind: StockDocKind;
    date?: string;
    warehouseFrom?: string; // расход, списание, инвентаризация, перемещение
    warehouseTo?: string; // приход, излишки, перемещение
    lines: StockDocLine[];
    note?: string;
    by?: string;
}

async function ownedWarehouse(org: string, id?: string | null) {
    if (!id) return null;
    const w = await prisma.warehouse.findFirst({ where: { id, org } });
    if (!w) throw new ProviderError("Склад не знайдено");
    return w;
}

/** Остаток по учёту: по всему складу фирмы или по конкретному складу (как в отчёте остатков). */
async function bookQuantities(org: string, productIds: string[], warehouseId: string | null): Promise<Map<string, number>> {
    const movements = await prisma.stockMovement.findMany({ where: { org, product: { in: productIds } }, select: { product: true, qty: true, warehouse: true, reason: true } });
    const list: MovementLike[] = movements.map((m) => ({
        product: m.product,
        warehouse: m.warehouse ?? null,
        qty: m.qty,
        reason: m.reason,
        unitCost: 0,
        at: "",
    }));
    const filtered = warehouseId ? list.filter((m) => (m.warehouse ?? "") === warehouseId) : list;
    const out = new Map<string, number>();
    for (const id of productIds) out.set(id, stockOnHand(filtered, id));
    return out;
}

/** Проведение документа: движения склада по строкам + запись в журнал движений. */
export async function postStockDoc(org: string, input: StockDocInput) {
    const lines = (input.lines ?? []).filter((l) => l.product && Number(l.qty) > 0);
    if (!lines.length) throw new ProviderError("У документі немає рядків з кількістю");
    if (input.kind === "transfer") {
        if (!input.warehouseFrom || !input.warehouseTo) throw new ProviderError("Для переміщення вкажіть склад-джерело та склад-отримувач");
        if (String(input.warehouseFrom) === String(input.warehouseTo)) throw new ProviderError("Склад-джерело та отримувач збігаються");
    }
    const from = await ownedWarehouse(org, input.warehouseFrom);
    const to = await ownedWarehouse(org, input.warehouseTo);
    if (input.kind === "receipt" && !to) throw new ProviderError("Для приходу вкажіть склад");
    if ((input.kind === "issue" || input.kind === "writeoff" || input.kind === "inventory") && !from) throw new ProviderError("Вкажіть склад, з якого списуємо");
    if (input.kind === "inventory" && !to) {
        // Инвентаризация и оприходует излишки, и списывает недостачу: без склада-получателя приход
        // излишка было бы некуда положить — считаем инвентаризацию по складу-источнику
        input.warehouseTo = input.warehouseFrom;
    }

    const settings = await financeSettings(org);
    const method = settings.stockCosting === "fifo" ? "fifo" : "avg";
    const number = await nextNumber(org, PREFIX[input.kind]);
    const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : new Date().toISOString().slice(0, 10);

    // Инвентаризация: количество в строке — фактическое; считаем расхождение с учётом и проводим
    // только его. Строки без расхождения остаются в документе как подтверждение подсчёта
    let prepared = lines.map((l) => ({ product: l.product, qty: Math.abs(Number(l.qty)), price: Number(l.price) || 0, diff: 0, note: (l.note ?? "").slice(0, 200) }));
    if (input.kind === "inventory") {
        const ids = Array.from(new Set(prepared.map((l) => String(l.product))));
        const book = await bookQuantities(org, ids, from ? from.id : null);
        prepared = prepared.map((l) => ({ ...l, diff: Math.round((l.qty - (book.get(String(l.product)) ?? 0)) * 10000) / 10000 }));
    }

    const doc = await prisma.stockDoc.create({
        data: {
            org,
            kind: input.kind,
            number,
            date,
            warehouseFrom: from ? from.id : null,
            warehouseTo: (to ?? (input.kind === "inventory" ? from : null)) ? (to ?? (input.kind === "inventory" ? from : null))!.id : null,
            lines: prepared as any,
            note: (input.note ?? "").slice(0, 500),
            by: input.by ?? "",
        },
    });

    await applyDocMovements(org, doc, method);
    return doc;
}

// Движения документа: приход +, расход -, перемещение — минус на источнике и плюс на получателе;
// инвентаризация — только на расхождение (diff)
async function applyDocMovements(org: string, doc: any, method: "avg" | "fifo", reverse = false) {
    const sign = reverse ? -1 : 1;
    for (const line of (doc.lines as any[]) ?? []) {
        const qty = Math.abs(Number(line.qty));
        const unitCost = Number(line.price) || (await currentUnitCost(org, String(line.product), method));
        if (doc.kind === "receipt" || doc.kind === "surplus") {
            // Приход и излишки: плюс на склад-получатель; цена строки (если задана) становится себестоимостью партии
            await moveStock(org, String(line.product), sign * qty, reverse ? "adjustment" : doc.kind === "receipt" ? "purchase" : "surplus", {
                warehouse: doc.warehouseTo ?? null,
                unitCost,
                docId: doc.id,
                note: `Документ ${doc.number}`,
                by: doc.by,
            });
        } else if (doc.kind === "transfer") {
            await moveStock(org, String(line.product), -sign * qty, reverse ? "adjustment" : "transfer_out", { warehouse: doc.warehouseFrom ?? null, unitCost, docId: doc.id, note: `Переміщення ${doc.number}`, by: doc.by });
            await moveStock(org, String(line.product), sign * qty, reverse ? "adjustment" : "transfer_in", { warehouse: doc.warehouseTo ?? null, unitCost, docId: doc.id, note: `Переміщення ${doc.number}`, by: doc.by });
        } else if (doc.kind === "inventory") {
            // Только расхождение: излишек приходуется, недостача списывается; нулевые строки — наблюдение
            const diff = Number(line.diff) || 0;
            if (!diff) continue;
            await moveStock(org, String(line.product), sign * diff, reverse ? "adjustment" : diff > 0 ? "surplus" : "writeoff", {
                warehouse: (diff > 0 ? doc.warehouseTo : doc.warehouseFrom) ?? null,
                unitCost,
                docId: doc.id,
                note: `Інвентаризація ${doc.number}`,
                by: doc.by,
            });
        } else {
            // Расход (issue) и списание: минус со склада-источника по выбранной оценке
            await moveStock(org, String(line.product), -sign * qty, reverse ? "adjustment" : doc.kind === "writeoff" ? "writeoff" : "sale", { warehouse: doc.warehouseFrom ?? null, unitCost, docId: doc.id, note: `Документ ${doc.number}`, by: doc.by });
        }
    }
}

async function currentUnitCost(org: string, product: string, method: "avg" | "fifo"): Promise<number> {
    if (method === "avg") {
        // Средняя по всем приходам товара — цена, по которой он лежит на складе «в среднем»
        const receipts = await prisma.stockMovement.findMany({ where: { org, product, qty: { gt: 0 } }, select: { qty: true, unitCost: true } });
        const movements = receipts.map((m) => ({ product, qty: m.qty, unitCost: m.unitCost ?? 0, reason: "purchase", at: "" }));
        const avg = averageCost(movements as never, product);
        // Приходов ещё не было (или все с нулевой ценой) — берём закупочную цену из карточки товара:
        // иначе первый приход лёг бы на склад с себестоимостью 0 и продажа считалась бы по нулю
        if (avg > 0) return avg;
    }
    const p = await prisma.product.findFirst({ where: { id: product, org }, select: { purchasePrice: true } });
    return Number(p?.purchasePrice) || 0;
}

/** Сторно документа: обратные движения и запись в журнал. Исходный документ не удаляется. */
export async function reverseStockDoc(org: string, docId: string, by = "") {
    const doc = await prisma.stockDoc.findFirst({ where: { id: docId, org } });
    if (!doc) throw new ProviderError("Документ не знайдено");
    if (doc.reversedBy) throw new ProviderError("Документ вже скасовано");
    const number = await nextNumber(org, "СТОР");
    const reversal = await prisma.stockDoc.create({
        data: {
            org,
            kind: doc.kind,
            number,
            date: new Date().toISOString().slice(0, 10),
            warehouseFrom: doc.warehouseFrom,
            warehouseTo: doc.warehouseTo,
            lines: doc.lines as any,
            note: `Сторно до ${doc.number}`,
            by,
            reversalOf: doc.id,
        },
    });
    await applyDocMovements(org, reversal, "avg", true);
    await prisma.stockDoc.update({ where: { id: docId }, data: { reversedBy: reversal.id } });
    return reversal;
}

/** Товары для строк документа: проверяем, что они принадлежат фирме. */
export async function assertProducts(org: string, ids: string[]) {
    const unique = Array.from(new Set(ids.filter((id) => validId(id))));
    const found = await prisma.product.count({ where: { id: { in: unique }, org } });
    if (found !== unique.length) throw new ProviderError("Деякі товари не знайдено");
}
