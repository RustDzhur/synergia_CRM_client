import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Фирма (рабочее пространство). Все данные CRM (контакты, сделки, интеграции, документы…) принадлежат фирме: поле owner в них —
// это _id фирмы. У личной фирмы, созданной автоматически, _id совпадает с _id пользователя, поэтому данные, созданные
// до появления фирм, остались на месте. Тариф и оплата — тоже у фирмы.
const OrganizationSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        ownerUser: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        plan: { type: String, enum: ["free", "standard", "professional"], default: "free" },
        // ручное назначение тарифа из админ-кабинета: действует, пока не отменено, независимо от Stripe
        planOverride: { type: String, enum: ["", "free", "standard", "professional"], default: "" },
        planOverrideUntil: { type: Date },
        billing: {
            customerId: { type: String, default: "" },
            subscriptionId: { type: String, default: "" },
            status: { type: String, default: "" },
            interval: { type: String, default: "" },
            currentPeriodEnd: { type: Date },
            cancelAtPeriodEnd: { type: Boolean, default: false },
        },
        blocked: { type: Boolean, default: false }, // фирму заблокировал администратор платформы
    },
    { timestamps: true }
);

export default registerModel("Organization", OrganizationSchema);
