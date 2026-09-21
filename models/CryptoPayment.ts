import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Счёт на оплату тарифа криптовалютой (NOWPayments). Вебхук находит его по orderId и не доверяет плану/сумме из самого вебхука.
const CryptoPaymentSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        plan: { type: String, enum: ["standard", "professional"], required: true },
        interval: { type: String, enum: ["month", "year"], required: true },
        amountEur: { type: Number, required: true },
        orderId: { type: String, required: true, unique: true },
        invoiceId: { type: String, default: "" },
        status: { type: String, default: "created" }, // created | waiting | confirming | partially_paid | finished | failed | expired | refunded
        applied: { type: Boolean, default: false }, // тариф уже включён по этому счёту (защита от повторного вебхука)
    },
    { timestamps: true }
);

export default registerModel("CryptoPayment", CryptoPaymentSchema);
