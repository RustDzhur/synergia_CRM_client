import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Строка счёта: снимок на момент выставления — если товар потом переименуют или изменят цену, старые счета не меняются.
const LineItemSchema = new Schema(
    {
        description: { type: String, required: true },
        qty: { type: Number, required: true, default: 1 },
        unitPrice: { type: Number, required: true, default: 0 }, // без налога
        taxRate: { type: Number, required: true, default: 0 }, // %
        product: { type: Schema.Types.ObjectId, ref: "Product" }, // не обязателен — можно вписать произвольную строку
    },
    { _id: false }
);

// Счёт на оплату (Rechnung/Invoice). Номер — последовательный без пропусков (lib/finance/numbering.ts), это требование
// закона о счетах во многих странах (например §14 UStG в Германии) — номер, однажды выданный, не меняется и не удаляется
// повторно (при отмене счёта — CreditNote или статус "cancelled", сам документ остаётся).
// Клиент и его адрес — тоже снимок (customerName/customerAddress/customerTaxId), а не только ссылка: юридический счёт должен
// показывать те данные, что были на момент выставления, даже если контакт потом переехал.
const InvoiceSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true }, // «RE-2026-1»
        kind: { type: String, enum: ["invoice", "credit_note"], default: "invoice" },
        creditFor: { type: Schema.Types.ObjectId, ref: "Invoice" }, // для kind "credit_note" — какой счёт корректирует

        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        customerName: { type: String, required: true },
        customerAddress: { type: String, default: "" },
        customerTaxId: { type: String, default: "" },

        deal: { type: Schema.Types.ObjectId, ref: "Deal" },
        order: { type: Schema.Types.ObjectId }, // Order, из которого выставлен счёт
        contract: { type: Schema.Types.ObjectId }, // Contract, если счёт по договору

        items: { type: [LineItemSchema], default: [] },
        currency: { type: String, default: "EUR" },
        smallBusinessNote: { type: Boolean, default: false }, // «Kleinunternehmerregelung»-пометка вместо налоговой строки

        issueDate: { type: String, required: true }, // "YYYY-MM-DD"
        dueDate: { type: String, default: "" },
        notes: { type: String, default: "" },

        status: { type: String, enum: ["draft", "sent", "paid", "overdue", "cancelled"], default: "draft" },
        sentAt: { type: Date },
        paidAt: { type: Date },
        paidAmount: { type: Number, default: 0 },

        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
InvoiceSchema.index({ org: 1, number: 1 }, { unique: true });
InvoiceSchema.index({ org: 1, status: 1, dueDate: 1 });
InvoiceSchema.index({ org: 1, createdAt: -1 });

export default registerModel("Invoice", InvoiceSchema);
