import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Сохраняемое сопоставление колонок (ТЗ §17): один раз разобрал файл поставщика — дальше он
// импортируется тем же шаблоном без разбора колонок заново.

const ImportMappingSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        kind: { type: String, required: true },
        name: { type: String, required: true }, // имя шаблона: «Прайс постачальника», «Каталог Rozetka»…
        mapping: { type: Schema.Types.Mixed, default: {} }, // заголовок колонки → поле
    },
    { timestamps: true }
);

ImportMappingSchema.index({ org: 1, kind: 1, name: 1 }, { unique: true });

export default registerModel("ImportMapping", ImportMappingSchema);
