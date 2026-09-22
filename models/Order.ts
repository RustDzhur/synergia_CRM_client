import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const OrderItemSchema = new Schema(
    {
        description: { type: String, required: true },
        qty: { type: Number, required: true, default: 1 },
        unitPrice: { type: Number, required: true, default: 0 },
        taxRate: { type: Number, required: true, default: 0 },
        product: { type: Schema.Types.ObjectId, ref: "Product" },
    },
    { _id: false }
);

// Внутренний заказ — связующее звено между сделкой и деньгами: «оформили контракт → создали заказ → закупка/резервирование
// товара под заказ (StockMovement с reason "sale") → выполнили → выставили счёт». Создание и смена статуса заказа сами
// становятся событиями автоматизации (order_created, order_status), поэтому от них можно завести уведомление «подготовить
// предложение», задачу и т.п. — как у сделок и задач.
const OrderSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true },

        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        customerName: { type: String, default: "" },
        deal: { type: Schema.Types.ObjectId, ref: "Deal" },
        contract: { type: Schema.Types.ObjectId },

        items: { type: [OrderItemSchema], default: [] },
        currency: { type: String, default: "EUR" },

        status: { type: String, enum: ["draft", "confirmed", "fulfilled", "invoiced", "closed", "cancelled"], default: "draft" },
        invoice: { type: Schema.Types.ObjectId, ref: "Invoice" }, // счёт, выставленный по этому заказу

        notes: { type: String, default: "" },
        responsible: { type: String, default: "" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
OrderSchema.index({ org: 1, number: 1 }, { unique: true });
OrderSchema.index({ org: 1, createdAt: -1 });

export default registerModel("Order", OrderSchema);
