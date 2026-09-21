import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Запрос счёта на банковский перевод: клиент выбрал тариф и хочет оплатить по счёту. Администратор платформы выставляет счёт
// вручную, а после оплаты включает тариф в админ-кабинете.
const InvoiceRequestSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
        email: { type: String, default: "" },
        plan: { type: String, enum: ["standard", "professional"], required: true },
        interval: { type: String, enum: ["month", "year"], required: true },
        company: { type: String, default: "" }, // название и реквизиты для счёта
        vatId: { type: String, default: "" },
        note: { type: String, default: "" },
        status: { type: String, enum: ["new", "done"], default: "new" },
    },
    { timestamps: true }
);

export default registerModel("InvoiceRequest", InvoiceRequestSchema);
