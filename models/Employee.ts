import { Schema, models, model } from "mongoose";

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

export default models.Employee || model("Employee", EmployeeSchema);