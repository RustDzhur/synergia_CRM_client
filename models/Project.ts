import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Проект — то, ради чего заведены задачи: запуск продукта, стройка, внедрение у клиента.
// Задачи ссылаются на проект, поэтому прогресс считается по ним, а не хранится отдельным числом
// (иначе он рано или поздно разошёлся бы с самими задачами).
const ProjectSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true },
        description: { type: String, default: "" },
        status: { type: String, enum: ["planned", "active", "paused", "done"], default: "planned" },
        startDate: { type: String, default: "" }, // "YYYY-MM-DD"
        endDate: { type: String, default: "" },
        responsible: { type: String, default: "" }, // как в задачах: имя строкой, без ссылки на пользователя
        color: { type: String, default: "#34A2E8" },
        // Заказчик проекта, если он ведётся для клиента
        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        company: { type: Schema.Types.ObjectId, ref: "Company" },
        archived: { type: Boolean, default: false },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
ProjectSchema.index({ owner: 1, archived: 1, createdAt: -1 });

export default registerModel("Project", ProjectSchema);
