import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Движение остатка склада: каждая запись — плюс или минус к Product.stockQty, с причиной и (если применимо) ссылкой на
// заказ/счёт, который его вызвал. Product.stockQty — это просто кэш суммы всех движений (см. lib/finance/stock.ts) —
// историю не трогаем и не переписываем, только добавляем записи.
const StockMovementSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
        qty: { type: Number, required: true }, // положительное — приход, отрицательное — расход
        reason: { type: String, enum: ["purchase", "sale", "writeoff", "adjustment", "return"], required: true },
        orderId: { type: Schema.Types.ObjectId }, // Order, если движение вызвано заказом
        note: { type: String, default: "" },
        by: { type: String, default: "" }, // имя, кто провёл движение
    },
    { timestamps: true }
);
StockMovementSchema.index({ org: 1, product: 1, createdAt: -1 });

export default registerModel("StockMovement", StockMovementSchema);
