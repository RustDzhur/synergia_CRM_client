import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Пакет импорта (ТЗ §17): что приехало из файла, что получилось и как это откатить.
//
// Откат — не «удалить всё подряд»: созданные записи удаляются по списку id, изменённые возвращаются
// к снимку прежних значений (updatedBefore), а созданные движения склада гасятся обратными
// движениями (журнал склада неизменяем — см. lib/finance/stock.ts). Поэтому пакет хранит ровно
// то, что создал сам.

const ImportBatchSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        kind: { type: String, required: true }, // products | contacts | companies | stock
        fileName: { type: String, default: "" },
        by: { type: String, default: "" }, // кто импортировал — видно в журнале действий
        summary: {
            total: { type: Number, default: 0 },
            created: { type: Number, default: 0 },
            updated: { type: Number, default: 0 },
            skipped: { type: Number, default: 0 },
            failed: { type: Number, default: 0 },
        },
        // Строка отчёта: что случилось с каждой строкой файла (номер строки в файле, без заголовка)
        log: { type: [{ _id: false, row: Number, status: String, message: String }], default: [] },
        createdIds: { type: [Schema.Types.ObjectId], default: [] },
        updatedBefore: { type: [{ _id: false, id: Schema.Types.ObjectId, before: Schema.Types.Mixed }], default: [] },
        stockMovements: { type: [Schema.Types.ObjectId], default: [] },
        rolledBackAt: { type: Date, default: null },
    },
    { timestamps: true }
);

ImportBatchSchema.index({ org: 1, createdAt: -1 });

export default registerModel("ImportBatch", ImportBatchSchema);
