import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Письмо, загруженное из подключённого ящика (или отправленное/сохранённое как черновик из CRM).
// deleted — «удалено в CRM»: запись остаётся, чтобы следующая синхронизация не загрузила письмо заново.
const MailMessageSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        account: { type: Schema.Types.ObjectId, ref: "Integration", required: true },
        externalId: { type: String, required: true }, // Message-ID письма или id у Gmail/Outlook
        folder: { type: String, enum: ["inbox", "sent", "draft"], required: true },
        from: { type: String, default: "" },
        to: { type: String, default: "" },
        subject: { type: String, default: "" },
        body: { type: String, default: "" },
        at: { type: Date, required: true },
        read: { type: Boolean, default: false },
        starred: { type: Boolean, default: false },
        snoozed: { type: Boolean, default: false },
        deleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);
MailMessageSchema.index({ account: 1, externalId: 1 }, { unique: true });
MailMessageSchema.index({ account: 1, folder: 1, at: -1 });

export default registerModel("MailMessage", MailMessageSchema);
