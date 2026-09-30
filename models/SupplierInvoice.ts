import { Schema } from "mongoose";

import { registerModel } from "@/lib/registerModel";

// Счёт поставщика (ТЗ §12): долг фирмы. Приход товара создаёт счёт (если указали номер и срок),
// оплата отмечается вручную или сверкой с банком; частичные оплаты копятся так же, как у клиентских.

const SupplierInvoiceSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        supplier: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
        purchase: { type: Schema.Types.ObjectId, ref: "PurchaseOrder", default: null },
        number: { type: String, default: "" }, // номер счёта поставщика
        date: { type: String, required: true },
        dueDate: { type: String, default: "" },
        amount: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        currency: { type: String, default: "EUR" },
        status: { type: String, enum: ["open", "paid", "cancelled"], default: "open" },
        notes: { type: String, default: "" },
    },
    { timestamps: true }
);

SupplierInvoiceSchema.index({ org: 1, date: -1 });

export default registerModel("SupplierInvoice", SupplierInvoiceSchema);
