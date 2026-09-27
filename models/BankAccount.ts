import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Счёт в банке или касса (Kasse) — то, где реально лежат деньги.
// kind разделяет их, потому что кассовая книга в Германии ведётся отдельно и по своим правилам
// (ежедневный подсчёт остатка), а банковские операции просто выгружаются и сверяются со счетами.
const BankAccountSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        kind: { type: String, enum: ["bank", "cash"], default: "bank" },
        name: { type: String, required: true },
        iban: { type: String, default: "" },
        bic: { type: String, default: "" },
        currency: { type: String, default: "EUR" },
        // Остаток на начало: без него сальдо по счёту не сойдётся с банковской выпиской
        openingBalance: { type: Number, default: 0 },
        openingDate: { type: String, default: "" }, // "YYYY-MM-DD"
        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);
BankAccountSchema.index({ org: 1, name: 1 }, { unique: true });

export default registerModel("BankAccount", BankAccountSchema);
