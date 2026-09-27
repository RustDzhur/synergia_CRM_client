import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const MessageSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
        conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
        integration: { type: Schema.Types.ObjectId, ref: "Integration", required: true },
        direction: { type: String, enum: ["in", "out"], required: true },
        kind: { type: String, enum: ["text", "call"], default: "text" },
        text: { type: String, default: "" },
        status: { type: String, enum: ["sent", "failed"], default: "sent" },
        externalId: { type: String }, // id сообщения у провайдера — защита от повторной доставки вебхука
        // вложение (фото, файл, голосовое): path — путь в хранилище фирмы, по нему файл отдаётся в переписке
        attachment: {
            type: new Schema(
                { kind: { type: String, enum: ["image", "file", "voice"] }, name: String, mime: String, size: Number, path: String },
                { _id: false }
            ),
            default: null,
        },
        meta: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, minimize: false }
);
MessageSchema.index(
    { integration: 1, externalId: 1 },
    { unique: true, partialFilterExpression: { externalId: { $type: "string" } } }
);

export default registerModel("Message", MessageSchema);
