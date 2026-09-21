import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Обращение с формы Contact на сайте (публичная форма, без входа)
const ContactMessageSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, default: "", trim: true },
        message: { type: String, required: true },
        locale: { type: String, default: "en" },
    },
    { timestamps: true }
);

export default registerModel("ContactMessage", ContactMessageSchema);
