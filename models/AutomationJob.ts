import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Отложенное действие правила («через 1 час», «через сутки»): выполняется, когда наступит runAt (см. lib/automation)
const AutomationJobSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        rule: { type: String, required: true }, // rid правила
        event: { type: Schema.Types.Mixed, default: {} },
        runAt: { type: Date, required: true },
        done: { type: Boolean, default: false },
    },
    { timestamps: true, minimize: false }
);
AutomationJobSchema.index({ done: 1, runAt: 1 });

export default registerModel("AutomationJob", AutomationJobSchema);
