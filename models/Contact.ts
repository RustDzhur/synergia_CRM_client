import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";
import { ActivitySchema } from "@/lib/activities";

const ContactSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true }, // полное имя; собирается из firstName + lastName, если они заданы
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        email: String,
        phone: String,
        company: String, // свободный текст (название компании) — остаётся как отображаемый снимок
        companyId: { type: Schema.Types.ObjectId, ref: "Company", default: null }, // реальная ссылка, если выбрана из подсказки
        position: String, // «Role» в макете
        website: { type: String, default: "" },
        twitter: { type: String, default: "" },
        facebook: { type: String, default: "" },
        notes: String,
        source: { type: String, default: "" }, // откуда появился контакт: "email" — создан автоматически из входящего письма
        activities: { type: [ActivitySchema], default: [] },
    },
    { timestamps: true }
);

export default registerModel("Contact", ContactSchema);
