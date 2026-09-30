import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Склад, магазин или место хранения (ТЗ §12). Несколько складов у одной фирмы — обычное дело:
// основной склад, магазин, транзит. Остаток товара — сумма движений по складам; выключенный склад
// остаётся в истории, но в выборе не предлагается.

const WarehouseSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        name: { type: String, required: true },
        kind: { type: String, enum: ["warehouse", "store", "transit"], default: "warehouse" },
        address: { type: String, default: "" },
        isDefault: { type: Boolean, default: false }, // склад, выбранный в формах по умолчанию
        archived: { type: Boolean, default: false },
    },
    { timestamps: true }
);

WarehouseSchema.index({ org: 1, name: 1 }, { unique: true });

export default registerModel("Warehouse", WarehouseSchema);
