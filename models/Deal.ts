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

        contactName: { type: String, default: "" }, // «Client → Contact»
        companyName: { type: String, default: "" }, // «Client → Company»
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
