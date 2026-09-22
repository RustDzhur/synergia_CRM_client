import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";
import { ActivitySchema } from "@/lib/activities";

const DealSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        stage: { type: Schema.Types.ObjectId, ref: "Stage", required: true, index: true },
        // Название сделки («Name» / «New Task» в макете). Поле называется clientName исторически.
        clientName: { type: String, required: true },
        order: { type: Number, required: true }, // порядок карточки внутри колонки

        contactName: { type: String, default: "" }, // «Client → Contact» — свободный текст (может быть несколько участников через запятую)
        companyName: { type: String, default: "" }, // «Client → Company»
        // Реальная ссылка, если контакт/компания выбраны из подсказки (не просто вписаны текстом) — contactName/companyName
        // остаются как отображаемый текст/снимок, contact/company — источник истины для трассировки и отчётов.
        contact: { type: Schema.Types.ObjectId, ref: "Contact", default: null },
        company: { type: Schema.Types.ObjectId, ref: "Company", default: null },
        startDate: { type: String, default: "" }, // "YYYY-MM-DD"
        endDate: { type: String, default: "" },

        // раздел «More» в карточке сделки
        dealType: { type: String, default: "" },
        responsible: { type: String, default: "" },
        availableToAll: { type: Boolean, default: true },
        utm: { type: String, default: "" },
        recurring: { type: String, default: "" }, // раздел «Recurring Deal»

        activities: { type: [ActivitySchema], default: [] },
    },
    { timestamps: true }
);

export default registerModel("Deal", DealSchema);
