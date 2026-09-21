import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Приглашение человека, у которого ещё нет аккаунта: при регистрации с этим e-mail он сам попадёт в фирму
const InvitationSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        email: { type: String, required: true, lowercase: true, trim: true, index: true },
        role: { type: String, enum: ["admin", "manager", "employee", "viewer"], default: "employee" },
        modules: { type: [String], default: [] },
        invitedBy: { type: Schema.Types.ObjectId, ref: "User" },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

export default registerModel("Invitation", InvitationSchema);
