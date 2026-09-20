import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const StageSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true }, // "Title one" в макете — реальное имя задаёт пользователь
        order: { type: Number, required: true }, // порядок колонок слева направо
        color: { type: String, default: "" }, // "#RRGGBB"; пусто — цвет по порядковому номеру (см. StageColumn)
    },
    { timestamps: true }
);

export default registerModel("Stage", StageSchema);
