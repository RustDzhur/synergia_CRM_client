import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Основное средство (Anlagegut): то, что фирма купила не на один год и что списывается постепенно.
// Из этих записей считается амортизация (AfA), которая потом попадает в EÜR и BWA как расход —
// без неё отчёт о прибыли завышал бы результат в год покупки техники.
const AssetSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        name: { type: String, required: true },
        category: { type: String, default: "" }, // «IT», «Fuhrpark», «Möbel» — свободная строка, как у расходов
        // Дата ввода в эксплуатацию: с месяца приобретения начинается амортизация (в Германии — правило §7 EStG,
        // списание с месяца покупки; поэтому период считаем по месяцам, а не по полным годам)
        acquiredDate: { type: String, required: true }, // "YYYY-MM-DD"
        cost: { type: Number, required: true }, // стоимость приобретения без налога
        currency: { type: String, default: "EUR" },
        usefulLifeYears: { type: Number, required: true, min: 1, max: 100 }, // срок полезного использования
        // Прямолинейный способ (linear): единственный, который можно посчитать без таблиц и допущений.
        // Прочие способы в Германии требуют обоснования, поэтому их здесь сознательно нет.
        method: { type: String, enum: ["linear"], default: "linear" },
        residualValue: { type: Number, default: 0 }, // ликвидационная стоимость, не амортизируется
        disposalDate: { type: String, default: "" }, // выбытие: амортизация прекращается
        notes: { type: String, default: "" },
        // Расход, из которого создано основное средство (если его завели из чека), — чтобы не задваивать затраты
        expense: { type: Schema.Types.ObjectId, ref: "Expense" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
AssetSchema.index({ org: 1, acquiredDate: -1 });

export default registerModel("Asset", AssetSchema);
