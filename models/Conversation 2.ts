import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Беседа с одним внешним собеседником в одном канале: чат Telegram, номер телефона, посетитель сайта…
const ConversationSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        integration: { type: Schema.Types.ObjectId, ref: "Integration", required: true },
        channel: { type: String, required: true },
        externalId: { type: String, required: true }, // id чата / номер / id посетителя
        name: { type: String, default: "" },
        contact: { type: Schema.Types.ObjectId, ref: "Contact" },
        lastText: { type: String, default: "" },
        lastAt: { type: Date, default: Date.now },
        unread: { type: Number, default: 0 },
    },
    { timestamps: true }
);
ConversationSchema.index({ integration: 1, externalId: 1 }, { unique: true });

export default registerModel("Conversation", ConversationSchema);
