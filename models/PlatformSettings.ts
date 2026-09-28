import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Настройки всей платформы, а не отдельной фирмы. Сейчас здесь лежит приложение Meta: через него фирмы
// подключают свои страницы Facebook и номера WhatsApp, поэтому ключи должны быть общими — у клиента
// своего приложения Meta нет. Одна запись на ключ; секретная часть шифруется, как секреты интеграций.
const PlatformSettingsSchema = new Schema(
    {
        key: { type: String, required: true, unique: true },
        value: { type: String, default: "" }, // несекретная часть (например, App ID)
        secrets: { type: String, default: "" }, // секретная часть (App Secret), зашифрована
    },
    { timestamps: true }
);

export default registerModel("PlatformSettings", PlatformSettingsSchema);
