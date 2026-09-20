import { Schema, models, model } from "mongoose";

const DealSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        stage: { type: Schema.Types.ObjectId, ref: "Stage", required: true, index: true },
        clientName: { type: String, required: true }, // "Client Name" в макете
        order: { type: Number, required: true }, // порядок карточки внутри колонки
    },
    { timestamps: true }
);

export default models.Deal || model("Deal", DealSchema);