import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Расход (Beleg): закупка материалов для клиента, аренда, подписки и т.п. — вторая половина отчёта «доходы/расходы»
// на дашборде наравне со счетами. receipt — файл чека/квитанции, тот же склад, что и Documents (DocItem).
const ExpenseSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        vendor: { type: String, required: true },
        category: { type: String, default: "" }, // «Materials», «Rent», «Software»... — произвольная строка, не справочник
        amount: { type: Number, required: true }, // без налога
        taxRate: { type: Number, default: 0 },
        currency: { type: String, default: "EUR" },
        date: { type: String, required: true }, // "YYYY-MM-DD"
        deal: { type: Schema.Types.ObjectId, ref: "Deal" }, // расход по конкретному клиенту/сделке, если применимо
        order: { type: Schema.Types.ObjectId },
        receipt: { type: Schema.Types.ObjectId, ref: "DocItem" },
        recurring: { type: String, enum: ["", "monthly", "yearly"], default: "" },
        notes: { type: String, default: "" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
ExpenseSchema.index({ org: 1, date: -1 });

export default registerModel("Expense", ExpenseSchema);
