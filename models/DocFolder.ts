import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Папка раздела Online Documents. driveId — одноимённая папка в Google Drive пользователя (создаётся при первом документе в ней).
const DocFolderSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true },
        parent: { type: Schema.Types.ObjectId, ref: "DocFolder", default: null },
        driveId: { type: String, default: "" },
    },
    { timestamps: true }
);

export default registerModel("DocFolder", DocFolderSchema);
