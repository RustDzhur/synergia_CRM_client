import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Запись ленты фирмы (Collaboration → Feed): пост коллеги, новость фирмы или карточка задачи, которую создал кто-то из команды.
// Комментарии, «следить» и смайлики-реакции работают между участниками фирмы; о новых записях и комментариях остальные получают уведомления.
const CommentSchema = new Schema({
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, default: "" },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

// Реакция-смайлик: сам emoji и те, кто его поставил (одна реакция на человека)
const ReactionSchema = new Schema(
    {
        emoji: { type: String, required: true },
        users: { type: [Schema.Types.ObjectId], default: [] },
    },
    { _id: false }
);

const FeedPostSchema = new Schema(
    {
        org: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
        author: { type: Schema.Types.ObjectId, ref: "User", required: true },
        authorName: { type: String, default: "" },
        kind: { type: String, enum: ["post", "task", "news"], default: "post" },
        text: { type: String, default: "" }, // текст поста
        taskId: { type: Schema.Types.ObjectId }, // для kind "task"
        taskTitle: { type: String, default: "" },
        responsible: { type: String, default: "" },
        // срок поручения в формате "YYYY-MM-DDTHH:mm" (как у задачи) — показывается в карточке записи
        dueAt: { type: String, default: "" },
        // кому адресована запись: всей фирме или конкретным людям (audienceIds — id участников фирмы)
        audience: { type: String, enum: ["all", "people"], default: "all" },
        audienceIds: { type: [Schema.Types.ObjectId], default: [] },
        audienceNames: { type: [String], default: [] }, // имена на момент публикации — чтобы карточка не ходила в User на каждый показ
        reactions: { type: [ReactionSchema], default: [] },
        pinned: { type: Boolean, default: false },
        followers: { type: [Schema.Types.ObjectId], default: [] },
        comments: { type: [CommentSchema], default: [] },
    },
    { timestamps: true }
);
FeedPostSchema.index({ org: 1, createdAt: -1 });

export default registerModel("FeedPost", FeedPostSchema);
