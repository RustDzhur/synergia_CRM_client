import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Публичная ссылка на документ фирмы: клиент открывает её без входа в CRM и видит статус заказа,
// состав и оплату — и может принять предложение. Ссылка — отдельная запись, а не поле документа:
// её можно отозвать, у неё свой срок жизни, и по ней видно, открывал ли клиент страницу.
const ShareLinkSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        kind: { type: String, enum: ["order", "quote"], required: true },
        ref: { type: Schema.Types.ObjectId, required: true }, // сам заказ или предложение
        token: { type: String, required: true, unique: true },
        expiresAt: { type: Date },
        views: { type: Number, default: 0 },
        lastViewAt: { type: Date },
        createdByName: { type: String, default: "" },
    },
    { timestamps: true }
);
ShareLinkSchema.index({ org: 1, kind: 1, ref: 1 }, { unique: true });

export default registerModel("ShareLink", ShareLinkSchema);
