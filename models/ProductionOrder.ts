import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Производственный заказ (ТЗ §13): план → запуск (резерв материалов) → выпуск (списание и
// оприходование на склад). Стоимость считается по факту: материалы по себестоимости склада,
// труд по фактическому времени, накладные — процентом от труда; план хранится рядом для сравнения.

const ProdMaterialSchema = new Schema(
    {
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        qty: { type: Number, required: true }, // потребность на весь план
        usedQty: { type: Number, default: 0 }, // списано на выпущенное
        unitCost: { type: Number, default: 0 },
    },
    { _id: false }
);

const ProdOperationSchema = new Schema(
    {
        name: { type: String, required: true },
        minutes: { type: Number, default: 0 }, // план на весь заказ
        actualMinutes: { type: Number, default: 0 },
        costPerHour: { type: Number, default: 0 },
        workCenter: { type: String, default: "" },
    },
    { _id: false }
);

const ProductionOrderSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        number: { type: String, required: true },
        bom: { type: Schema.Types.ObjectId, ref: "Bom", required: true },
        product: { type: Schema.Types.ObjectId, ref: "Product", required: true }, // основное изделие
        planQty: { type: Number, required: true },
        producedQty: { type: Number, default: 0 },
        scrapQty: { type: Number, default: 0 }, // брак: выпускается, но списывается отдельно
        status: { type: String, enum: ["plan", "launched", "done", "cancelled"], default: "plan" },
        warehouseMaterials: { type: Schema.Types.ObjectId, ref: "Warehouse", default: null },
        warehouseOutput: { type: Schema.Types.ObjectId, ref: "Warehouse", default: null },
        materials: { type: [ProdMaterialSchema], default: [] },
        operations: { type: [ProdOperationSchema], default: [] },
        costs: {
            materials: { type: Number, default: 0 },
            labor: { type: Number, default: 0 },
            overhead: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
        },
        planCost: { type: Number, default: 0 }, // план себестоимости всего заказа
        due: { type: String, default: "" },
        note: { type: String, default: "" },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);

ProductionOrderSchema.index({ org: 1, number: 1 }, { unique: true });

export default registerModel("ProductionOrder", ProductionOrderSchema);
