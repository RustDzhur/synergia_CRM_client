import { Schema } from "mongoose";
import { registerModel } from "@/lib/registerModel";

// Тексты на трёх языках — та же форма {en, de, ua}, что и в app/content/i18n.ts (t3/Tx), просто как под-документ,
// а не константа в коде: статьи блога теперь создаёт/удаляет владелец платформы из админки (/crm/admin), а не разработчик.
const TxSchema = new Schema({ en: { type: String, default: "" }, de: { type: String, default: "" }, ua: { type: String, default: "" } }, { _id: false });

// Статья блога на лендинге (/blog, /blog/:slug). Публично видны только published:true; черновики видны только в админке.
const BlogPostSchema = new Schema(
    {
        slug: { type: String, required: true, unique: true },
        image: { type: String, default: "/images/blog/code.jpg" },
        title: { type: TxSchema, default: () => ({}) },
        excerpt: { type: TxSchema, default: () => ({}) },
        body: { type: [TxSchema], default: [] }, // один элемент — один абзац
        published: { type: Boolean, default: true },
        publishedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default registerModel("BlogPost", BlogPostSchema);
