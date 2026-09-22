import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Товар или услуга — общий каталог для склада, заказов, счетов и предложений. Услуга (type "service") не имеет остатка
// (stockQty игнорируется); товар (type "good") — есть, и его меняют только StockMovement-записи, не прямая правка поля
// (см. lib/finance/stock.ts), чтобы остаток всегда сходился с историей движений.
const ProductSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        name: { type: String, required: true },
        sku: { type: String, default: "" },
        type: { type: String, enum: ["good", "service"], default: "service" },
        unit: { type: String, default: "pcs" }, // «pcs», «h», «kg»...
        purchasePrice: { type: Number, default: 0 }, // закупочная цена — себестоимость для отчёта о прибыли
        salePrice: { type: Number, default: 0 },
        taxRate: { type: Number, default: null }, // null — берём ставку по умолчанию из FinanceSettings на момент выставления счёта
        stockQty: { type: Number, default: 0 }, // только для type "good"; источник истины — сумма StockMovement
        reorderLevel: { type: Number, default: 0 }, // ниже этого — «Low stock» на дашборде
        archived: { type: Boolean, default: false },
    },
    { timestamps: true }
);
ProductSchema.index({ org: 1, name: 1 });

export default registerModel("Product", ProductSchema);
