import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Запись таблицы раздела (Automation, Marketing, Inventory…): key — «раздел:вкладка», rid — идентификатор записи для интерфейса.
// Запись с rid "__init__" — отметка «вкладку уже правили»: до неё показываются тестовые данные раздела, после — только сохранённые.
const SectionRecordSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
        key: { type: String, required: true },
        rid: { type: String, required: true },
        values: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, minimize: false }
);
SectionRecordSchema.index({ org: 1, key: 1, rid: 1 }, { unique: true });

export default registerModel("SectionRecord", SectionRecordSchema);
