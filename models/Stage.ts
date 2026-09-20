import { Schema, models, model } from "mongoose";

const StageSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true }, // "Title one" в макете — реальное имя задаёт пользователь
        order: { type: Number, required: true }, // порядок колонок слева направо
    },
    { timestamps: true }
);

export default models.Stage || model("Stage", StageSchema);