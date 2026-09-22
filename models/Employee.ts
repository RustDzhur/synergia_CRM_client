import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

const EmployeeSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        firstname: { type: String, required: true },
        lastname: { type: String, required: true },
        email: { type: String, required: true },
        workPhone: String,
        internalPhone: String,
        position: String,
        department: String,
        avatarUrl: String,
        // из распознанного документа (Firmspace AI → Documents → «Analyze»), например трудового договора
        contractType: { type: String, default: "" },
        contractStart: { type: String, default: "" }, // "YYYY-MM-DD"
        contractNote: { type: String, default: "" }, // краткое резюме документа, из которого взяты поля
    },
    { timestamps: true }
);

export default registerModel("Employee", EmployeeSchema);
