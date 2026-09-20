import { Schema, models, model } from "mongoose";

const ContactSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        name: { type: String, required: true },
        email: String,
        phone: String,
        company: String,
        position: String,
        notes: String,
    },
    { timestamps: true }
);

export default models.Contact || model("Contact", ContactSchema);