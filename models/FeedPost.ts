import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Запись ленты фирмы (Collaboration → Feed): пост коллеги или карточка задачи, которую создал кто-то из команды.
// Комментарии и «следить» работают между участниками фирмы; о новых записях и комментариях остальные получают уведомления.
const CommentSchema = new Schema({
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, default: "" },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const FeedPostSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        author: { type: Schema.Types.ObjectId, ref: "User", required: true },
        authorName: { type: String, default: "" },
        kind: { type: String, enum: ["post", "task"], default: "post" },
        text: { type: String, default: "" }, // текст поста
        taskId: { type: Schema.Types.ObjectId }, // для kind "task"
        taskTitle: { type: String, default: "" },
        responsible: { type: String, default: "" },
        pinned: { type: Boolean, default: false },
        followers: { type: [Schema.Types.ObjectId], default: [] },
        comments: { type: [CommentSchema], default: [] },
    },
    { timestamps: true }
);
FeedPostSchema.index({ org: 1, createdAt: -1 });

export default registerModel("FeedPost", FeedPostSchema);
