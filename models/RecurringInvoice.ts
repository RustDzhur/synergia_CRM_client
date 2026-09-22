import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const LineItemSchema = new Schema(
    {
        description: { type: String, required: true },
        qty: { type: Number, required: true, default: 1 },
        unitPrice: { type: Number, required: true, default: 0 },
        taxRate: { type: Number, required: true, default: 0 },
        product: { type: Schema.Types.ObjectId, ref: "Product" },
    },
    { _id: false }
);

// Шаблон повторяющегося счёта: раз в interval (monthly/yearly), в день dayOfMonth, крон создаёт из него новый Invoice
// (lib/finance/recurring.ts) и сдвигает nextRunDate на следующий период — сам шаблон не является счётом и номера не получает.
const RecurringInvoiceSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        active: { type: Boolean, default: true },

        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        customerName: { type: String, required: true },
        customerAddress: { type: String, default: "" },
        customerTaxId: { type: String, default: "" },

        items: { type: [LineItemSchema], default: [] },
        currency: { type: String, default: "EUR" },
        notes: { type: String, default: "" },

        interval: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
        dayOfMonth: { type: Number, default: 1, min: 1, max: 28 }, // 28, чтобы всегда существовал в любом месяце
        autoSend: { type: Boolean, default: false }, // false — создаёт черновик на проверку; true — сразу отправляет

        nextRunDate: { type: String, required: true }, // "YYYY-MM-DD"
        lastRunAt: { type: Date },
        lastInvoice: { type: Schema.Types.ObjectId, ref: "Invoice" },
    },
    { timestamps: true }
);
RecurringInvoiceSchema.index({ org: 1, active: 1, nextRunDate: 1 });

export default registerModel("RecurringInvoice", RecurringInvoiceSchema);
