import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const UserSchema = new Schema(
    {
        firstname: { type: String, required: true, trim: true },
        lastname: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        // либо внешний URL, либо data:image/...;base64 (загрузка из окна профиля), либо пусто
        avatarUrl: { type: String, default: "" },
        // необязательные поля профиля (окно «Settings» в меню пользователя)
        phone: { type: String, default: "", trim: true },
        position: { type: String, default: "", trim: true },
        city: { type: String, default: "", trim: true },
        country: { type: String, default: "", trim: true },
        // страница Settings → Account
        role: { type: String, default: "", trim: true },
        department: { type: String, default: "", trim: true },
        postCode: { type: String, default: "", trim: true },
        languages: { type: String, default: "", trim: true },
        timezone: { type: String, default: "", trim: true },
        state: { type: String, default: "", trim: true },
        company: { type: String, default: "", trim: true },
        // страница Settings → Notifications
        notifications: {
            browser: { type: Boolean, default: false },
            email: { type: Boolean, default: false },
            muteEmail: { type: Boolean, default: false },
            muteFrom: { type: String, default: "10:00" },
            muteTo: { type: String, default: "10:00" },
        },
    },
    { timestamps: true }
);

export default registerModel("User", UserSchema);
