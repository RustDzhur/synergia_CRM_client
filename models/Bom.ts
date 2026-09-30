import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Спецификация (BOM/рецептура, ТЗ §13): из чего и как делается изделие.
// Состав может быть многоуровневым: компонент сам может иметь спецификацию — взрыв состава
// разворачивает всё до сырья (lib/finance/production.ts), с защитой от циклов.
// Нормы расхода даны на одно изделие, wastePercent — допустимый перерасход (угар, обрезки).

const BomComponentSchema = new Schema(
    {
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        qty: { type: Number, required: true }, // на одно изделие
        wastePercent: { type: Number, default: 0 }, // допустимый перерасход, %
        optional: { type: Boolean, default: false }, // заменяемый материал: можно не списывать
        note: { type: String, default: "" },
    },
    { _id: false }
);

const BomOperationSchema = new Schema(
    {
        name: { type: String, required: true },
        minutes: { type: Number, default: 0 }, // норма времени на изделие
        costPerHour: { type: Number, default: 0 }, // стоимость часа рабочего центра
        workCenter: { type: String, default: "" },
    },
    { _id: false }
);

const BomSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true }, // что производим
        name: { type: String, default: "" },
        version: { type: Number, default: 1 }, // версии: старая остаётся для истории
        active: { type: Boolean, default: true },
        components: { type: [BomComponentSchema], default: [] },
        operations: { type: [BomOperationSchema], default: [] },
        // Побочная продукция и несколько выходов: например, распил даёт доску и опилки
        outputs: { type: [{ _id: false, product: Schema.Types.ObjectId, qty: Number }], default: [] },
        overheadPercent: { type: Number, default: 0 }, // накладные расходы, % от трудовых затрат
        note: { type: String, default: "" },
    },
    { timestamps: true }
);

BomSchema.index({ org: 1, product: 1, version: -1 });

export default registerModel("Bom", BomSchema);
