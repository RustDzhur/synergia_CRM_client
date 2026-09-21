import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Документ Online Documents: Google Doc/Sheet/Slides (живёт в Google Drive пользователя, здесь — ссылка и метаданные)
// или загруженный файл/фото (лежит в Firebase Storage по пути storagePath).
const DocItemSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        kind: { type: String, enum: ["gdoc", "gsheet", "gslide", "file"], required: true },
        name: { type: String, required: true },
        folder: { type: Schema.Types.ObjectId, ref: "DocFolder", default: null, index: true },
        archived: { type: Boolean, default: false },
        createdByName: { type: String, default: "" },
        // Google
        driveId: { type: String, default: "" },
        url: { type: String, default: "" }, // ссылка «открыть в Google»
        modifiedAt: { type: Date },
        // файл
        storagePath: { type: String, default: "" },
        mime: { type: String, default: "" },
        size: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default registerModel("DocItem", DocItemSchema);
