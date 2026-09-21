import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Журнал действий ИИ: какие данные он читал (kind "read"), что предложил изменить (kind "proposed") и что пользователь подтвердил
// и выполнил (kind "executed"). Хранится 180 дней, видят владелец и администратор фирмы.
const AiLogSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        kind: { type: String, enum: ["read", "proposed", "executed", "failed"], required: true },
        tool: { type: String, required: true },
        args: { type: String, default: "" }, // JSON аргументов, обрезанный
        result: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now, expires: 180 * 86400 },
    },
    { minimize: false }
);
AiLogSchema.index({ org: 1, createdAt: -1 });

export default registerModel("AiLog", AiLogSchema);
