import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const QuoteItemSchema = new Schema(
    { description: { type: String, required: true }, qty: { type: Number, default: 1 }, unitPrice: { type: Number, default: 0 }, taxRate: { type: Number, default: 0 }, product: { type: Schema.Types.ObjectId, ref: "Product" } },
    { _id: false }
);

// Коммерческое предложение (Angebot/Quote): предшествует заказу. Пока без PDF/отправки — модель заведена, чтобы Order
// мог на неё ссылаться; API и интерфейс — следующим шагом.
const QuoteSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true },
        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        customerName: { type: String, default: "" },
        deal: { type: Schema.Types.ObjectId, ref: "Deal" },
        items: { type: [QuoteItemSchema], default: [] },
        currency: { type: String, default: "EUR" },
        issueDate: { type: String, default: "" },
        validUntil: { type: String, default: "" },
        status: { type: String, enum: ["draft", "sent", "accepted", "declined", "expired"], default: "draft" },
        sentAt: { type: Date },
        order: { type: Schema.Types.ObjectId, ref: "Order" }, // заказ, созданный из принятого предложения (см. /api/quotes/:id/order)
        notes: { type: String, default: "" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
QuoteSchema.index({ org: 1, number: 1 }, { unique: true });

export default registerModel("Quote", QuoteSchema);
