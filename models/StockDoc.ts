import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Документ склада (ТЗ §12): приход, расход, перемещение, списание, оприбуткування излишков,
// инвентаризация. Правило одно: остаток меняют только движения, а движения рождаются документами.
// Ошибку исправляют не правкой, а сторно — обратным документом, поэтому исходный документ и его
// сторно остаются в журнале навсегда.

const StockLineSchema = new Schema(
    {
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        qty: { type: Number, required: true }, // всегда положительное: знак задаёт вид документа
        price: { type: Number, default: 0 }, // цена в документе (приход — закупочная, списание — себестоимость); 0 — взять из карточки товара
        // Инвентаризация: qty — фактическое количество, diff — расхождение с учётом (плюс — излишек,
        // минус — недостача). Движения проводятся только на расхождение; для прочих видов 0.
        diff: { type: Number, default: 0 },
        note: { type: String, default: "" },
    },
    { _id: false }
);

const StockDocSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        kind: { type: String, enum: ["receipt", "issue", "transfer", "writeoff", "surplus", "inventory"], required: true },
        number: { type: String, required: true },
        date: { type: String, required: true }, // YYYY-MM-DD
        warehouseFrom: { type: Schema.Types.ObjectId, ref: "Warehouse", default: null }, // расход/перемещение/списание
        warehouseTo: { type: Schema.Types.ObjectId, ref: "Warehouse", default: null }, // приход/перемещение/излишки
        lines: { type: [StockLineSchema], default: [] },
        note: { type: String, default: "" },
        by: { type: String, default: "" },
        // Сторно: ссылка на отменяемый документ. Сторно-документ повторяет строки с обратным знаком
        reversalOf: { type: Schema.Types.ObjectId, ref: "StockDoc", default: null },
        reversedBy: { type: Schema.Types.ObjectId, ref: "StockDoc", default: null },
    },
    { timestamps: true }
);

StockDocSchema.index({ org: 1, date: -1 });
StockDocSchema.index({ org: 1, number: 1 }, { unique: true });

export default registerModel("StockDoc", StockDocSchema);
