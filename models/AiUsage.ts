import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Сколько запросов к ИИ сделала фирма за день (по местной дате сервера, UTC): лимит зависит от тарифа
const AiUsageSchema = new Schema({
    org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    day: { type: String, required: true }, // "YYYY-MM-DD"
    count: { type: Number, default: 0 },
});
AiUsageSchema.index({ org: 1, day: 1 }, { unique: true });

export default registerModel("AiUsage", AiUsageSchema);
