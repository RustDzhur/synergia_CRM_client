import { Types } from "mongoose";
import { ProviderError } from "@/lib/http";
import { nextNumber } from "./numbering";
import { financeSettings } from "./settings";
import { averageCost } from "./warehouse";
import { moveStock } from "./stock";
import Product from "@/models/Product";
import StockDoc from "@/models/StockDoc";
import StockMovement from "@/models/StockMovement";
import Warehouse from "@/models/Warehouse";

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
    warehouseFrom?: string; // расход, списание, перемещение
    warehouseTo?: string; // приход, излишки, перемещение
    lines: StockDocLine[];
    note?: string;
    by?: string;
}

async function ownedWarehouse(org: string, id?: string | null) {
    if (!id) return null;
    const w = await Warehouse.findOne({ _id: id, org });
    if (!w) throw new ProviderError("Склад не знайдено");
    return w;
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
    if ((input.kind === "issue" || input.kind === "writeoff") && !from) throw new ProviderError("Вкажіть склад, з якого списуємо");

    const settings = await financeSettings(org);
    const method = settings.stockCosting === "fifo" ? "fifo" : "avg";
    const number = await nextNumber(org, PREFIX[input.kind]);
    const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : new Date().toISOString().slice(0, 10);

    const doc = await StockDoc.create({
        org,
        kind: input.kind,
        number,
        date,
        warehouseFrom: from?._id ?? null,
        warehouseTo: to?._id ?? null,
        lines: lines.map((l) => ({ product: l.product, qty: Math.abs(Number(l.qty)), price: Number(l.price) || 0, note: (l.note ?? "").slice(0, 200) })),
        note: (input.note ?? "").slice(0, 500),
        by: input.by ?? "",
    });

    await applyDocMovements(org, doc, method);
    return doc;
}

// Движения документа: приход +, расход -, перемещение — минус на источнике и плюс на получателе
async function applyDocMovements(org: string, doc: any, method: "avg" | "fifo", reverse = false) {
    const sign = reverse ? -1 : 1;
    for (const line of doc.lines) {
        const qty = Math.abs(Number(line.qty));
        const unitCost = Number(line.price) || (await currentUnitCost(org, String(line.product), method));
        if (doc.kind === "receipt" || (doc.kind === "surplus") || (doc.kind === "inventory" && Number(line.price) > 0)) {
            // Приход и излишки: плюс на склад-получатель; цена строки становится себестоимостью партии
            await moveStock(org, String(line.product), sign * qty, reverse ? "adjustment" : doc.kind === "receipt" ? "purchase" : "surplus", {
                warehouse: doc.warehouseTo?._id ?? doc.warehouseTo ?? null,
                unitCost,
                docId: doc._id,
                note: `Документ ${doc.number}`,
                by: doc.by,
            });
        } else if (doc.kind === "transfer") {
            await moveStock(org, String(line.product), -sign * qty, reverse ? "adjustment" : "transfer_out", { warehouse: doc.warehouseFrom ?? null, unitCost, docId: doc._id, note: `Переміщення ${doc.number}`, by: doc.by });
            await moveStock(org, String(line.product), sign * qty, reverse ? "adjustment" : "transfer_in", { warehouse: doc.warehouseTo ?? null, unitCost, docId: doc._id, note: `Переміщення ${doc.number}`, by: doc.by });
        } else {
            // Расход и списание: минус со склада-источника по выбранной оценке
            await moveStock(org, String(line.product), -sign * qty, reverse ? "adjustment" : doc.kind === "writeoff" ? "writeoff" : "sale", { warehouse: doc.warehouseFrom ?? null, unitCost, docId: doc._id, note: `Документ ${doc.number}`, by: doc.by });
        }
    }
}

async function currentUnitCost(org: string, product: string, method: "avg" | "fifo"): Promise<number> {
    if (method === "avg") {
        // Средняя по всем приходам товара — цена, по которой он лежит на складе «в среднем»
        const receipts = await StockMovement.find({ org, product, qty: { $gt: 0 } }).select("qty unitCost");
        const movements = receipts.map((m) => ({ product, qty: m.qty, unitCost: m.unitCost ?? 0, reason: "purchase", at: "" }));
        return averageCost(movements as never, product);
    }
    const p = await Product.findOne({ _id: product, org }).select("purchasePrice");
    return Number(p?.purchasePrice) || 0;
}

/** Сторно документа: обратные движения и запись в журнал. Исходный документ не удаляется. */
export async function reverseStockDoc(org: string, docId: string, by = "") {
    const doc = await StockDoc.findOne({ _id: docId, org });
    if (!doc) throw new ProviderError("Документ не знайдено");
    if (doc.reversedBy) throw new ProviderError("Документ вже скасовано");
    const number = await nextNumber(org, "СТОР");
    const reversal = await StockDoc.create({
        org,
        kind: doc.kind,
        number,
        date: new Date().toISOString().slice(0, 10),
        warehouseFrom: doc.warehouseFrom,
        warehouseTo: doc.warehouseTo,
        lines: doc.lines,
        note: `Сторно до ${doc.number}`,
        by,
        reversalOf: doc._id,
    });
    await applyDocMovements(org, reversal, "avg", true);
    doc.reversedBy = reversal._id;
    await doc.save();
    return reversal;
}

/** Товары для строк документа: проверяем, что они принадлежат фирме. */
export async function assertProducts(org: string, ids: string[]) {
    const unique = Array.from(new Set(ids.filter((id) => Types.ObjectId.isValid(id))));
    const found = await Product.countDocuments({ _id: { $in: unique }, org });
    if (found !== unique.length) throw new ProviderError("Деякі товари не знайдено");
}
