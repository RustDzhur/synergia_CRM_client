import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Журнал финансово значимых действий (ТЗ §85): кто, что, над каким документом и когда. Не общий лог всего подряд —
// только точки, где не глядя нельзя понять "кто это сделал" по самому документу (Invoice/Contract и т.п. хранят
// свой статус, но не то, кто именно нажал кнопку). Пишется best-effort (см. lib/audit.ts) — сбой записи в аудит
// не должен ломать саму операцию.
const AuditLogSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        userName: { type: String, default: "" }, // снимок имени на момент действия — не "живая" ссылка
        action: { type: String, required: true }, // "invoice.sent", "invoice.paid", "contract.signed" и т.п.
        entityType: { type: String, required: true }, // "invoice" | "contract" | "expense" | "order" | "quote"...
        entityId: { type: Schema.Types.ObjectId, required: true },
        summary: { type: String, default: "" }, // короткое человекочитаемое описание для списка, без похода в документ
        meta: { type: Schema.Types.Mixed, default: {} }, // произвольные детали (сумма, статус до/после и т.п.)
    },
    { timestamps: true }
);
AuditLogSchema.index({ org: 1, createdAt: -1 });
AuditLogSchema.index({ org: 1, entityType: 1, entityId: 1 });

export default registerModel("AuditLog", AuditLogSchema);
