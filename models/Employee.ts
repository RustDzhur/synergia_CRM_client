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
    },
    { timestamps: true }
);

export default registerModel("Employee", EmployeeSchema);
