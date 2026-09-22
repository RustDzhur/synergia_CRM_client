import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Договор: привязан к клиенту и (не обязательно) сделке; файл самого договора — обычный документ (DocItem), здесь только
// метаданные и статус. Модель заведена как основа для Order/Invoice; API и интерфейс — следующим шагом.
const ContractSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true },
        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        customerName: { type: String, default: "" },
        deal: { type: Schema.Types.ObjectId, ref: "Deal" },
        value: { type: Number, default: 0 },
        currency: { type: String, default: "EUR" },
        startDate: { type: String, default: "" },
        endDate: { type: String, default: "" },
        status: { type: String, enum: ["draft", "active", "completed", "cancelled"], default: "draft" },
        signedAt: { type: Date },
        file: { type: Schema.Types.ObjectId, ref: "DocItem" },
        notes: { type: String, default: "" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
ContractSchema.index({ org: 1, number: 1 }, { unique: true });

export default registerModel("Contract", ContractSchema);
