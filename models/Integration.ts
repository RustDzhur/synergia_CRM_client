import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Подключение внешнего сервиса (Twilio, SIP-провайдер, Telegram, Viber, Messenger, онлайн-чат, почтовый ящик).
// config — несекретные настройки, secrets — зашифрованный JSON с токенами и паролями (см. lib/crypto.ts).
// token — случайная часть адреса вебхука: по ней провайдер попадает именно в эту интеграцию.
const IntegrationSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        type: { type: String, required: true, enum: ["twilio", "sip", "gdrive", "telegram", "viber", "messenger", "webchat", "mail"] },
        name: { type: String, default: "" },
        token: { type: String, required: true, unique: true },
        status: { type: String, enum: ["connected", "error"], default: "connected" },
        error: { type: String, default: "" },
        config: { type: Schema.Types.Mixed, default: {} },
        secrets: { type: String, default: "" },
        lastSyncAt: { type: Date },
    },
    { timestamps: true, minimize: false }
);

export default registerModel("Integration", IntegrationSchema);
