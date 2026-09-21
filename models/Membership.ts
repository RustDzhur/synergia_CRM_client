import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Участие пользователя в фирме: роль и (необязательно) точный список разделов, к которым у него есть доступ
const MembershipSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        role: { type: String, enum: ["owner", "admin", "manager", "employee", "viewer"], default: "employee" },
        modules: { type: [String], default: [] }, // пусто — разделы по умолчанию для роли
    },
    { timestamps: true }
);
MembershipSchema.index({ org: 1, user: 1 }, { unique: true });

export default registerModel("Membership", MembershipSchema);
