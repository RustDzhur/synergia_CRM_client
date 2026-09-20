import { Schema, models, model } from "mongoose";

const UserSchema = new Schema(
    {
        firstname: { type: String, required: true, trim: true },
        lastname: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        avatarUrl: { type: String, default: "" },
    },
    { timestamps: true }
);

export default models.User || model("User", UserSchema);