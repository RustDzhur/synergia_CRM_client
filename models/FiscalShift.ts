import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Смены кассы ПРРО (Checkbox): открытие, закрытие и итоги Z-отчёта. Чек принимается только при
// открытой смене, поэтому история смен — рабочий журнал кассира, а не украшение: по ней видно,
// закрыта ли смена и что показал Z-отчёт (количество чеков и оборот).

const FiscalShiftSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        provider: { type: String, default: "checkbox" },
        shiftId: { type: String, required: true }, // id смены в кассе Checkbox
        openedAt: { type: Date, default: Date.now },
        closedAt: { type: Date, default: null },
        receipts: { type: Number, default: 0 }, // сколько чеков за смену (из Z-отчёта)
        turnover: { type: Number, default: 0 }, // оборот смены, ₴
        zReport: { type: Schema.Types.Mixed, default: {} }, // сырой ответ кассы: бухгалтер увидит детали
    },
    { timestamps: true }
);

FiscalShiftSchema.index({ org: 1, shiftId: 1 }, { unique: true });

export default registerModel("FiscalShift", FiscalShiftSchema);
