import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Уведомление фирмы: пришло письмо, новый лид, пропущенный звонок, сообщение в канале, приближается дедлайн…
// user пуст — уведомление видят все участники фирмы; прочитанность хранится отдельно для каждого (readBy).
// key защищает от дублей: одно событие — одно уведомление.
// Текст собирается на клиенте по type и params, поэтому он на языке интерфейса пользователя.
const NotificationSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        user: { type: Schema.Types.ObjectId, ref: "User" },
        type: { type: String, required: true },
        params: { type: Schema.Types.Mixed, default: {} },
        link: { type: String, default: "" }, // путь в CRM без языка, например /crm/collaboration/web-mails
        key: { type: String },
        readBy: { type: [Schema.Types.ObjectId], default: [] },
    },
    { timestamps: true, minimize: false }
);
NotificationSchema.index({ org: 1, createdAt: -1 });
NotificationSchema.index({ org: 1, key: 1 }, { unique: true, partialFilterExpression: { key: { $type: "string" } } });

export default registerModel("Notification", NotificationSchema);
