import { Schema, models, model } from "mongoose";

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
    },
    { timestamps: true }
);

export default models.User || model("User", UserSchema);
