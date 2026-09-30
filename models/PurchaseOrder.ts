import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Заказ поставщику (ТЗ §12): план закупки. Статусы: черновик → подтверждён → принят (оприходован)
// → отменён. Приход оформляется документом склада, а счёт поставщика попадает в долги — заказ сам
// остаток не меняет.

const PurchaseLineSchema = new Schema(
    {
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        qty: { type: Number, required: true },
        price: { type: Number, default: 0 },
        receivedQty: { type: Number, default: 0 }, // сколько уже принято (приход может быть частичным)
        note: { type: String, default: "" },
    },
    { _id: false }
);

const PurchaseOrderSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true },
        supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
        date: { type: String, required: true }, // YYYY-MM-DD
        expectedDate: { type: String, default: "" },
        status: { type: String, enum: ["draft", "confirmed", "received", "cancelled"], default: "draft" },
        lines: { type: [PurchaseLineSchema], default: [] },
        currency: { type: String, default: "EUR" },
        warehouse: { type: Schema.Types.ObjectId, ref: "Warehouse", default: null }, // куда принимаем
        notes: { type: String, default: "" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);

PurchaseOrderSchema.index({ org: 1, number: 1 }, { unique: true });

export default registerModel("PurchaseOrder", PurchaseOrderSchema);
