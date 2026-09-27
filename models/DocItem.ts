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
        // Импортированный с Диска файл: он был там до CRM, и прав на запись к нему у приложения нет —
        // CRM правит только свою запись, а не файл на Диске.
        imported: { type: Boolean, default: false },
        // Имя файла на Диске на момент последней синхронизации: по нему видно, переименовали файл на Диске
        // (тогда имя меняет и CRM) или в CRM (тогда имя на Диске чужое и его не трогаем).
        driveName: { type: String, default: "" },
        // файл
        storagePath: { type: String, default: "" },
        mime: { type: String, default: "" },
        size: { type: Number, default: 0 },
    },
    { timestamps: true }
);

export default registerModel("DocItem", DocItemSchema);
