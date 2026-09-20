import { NextResponse } from "next/server";
import { Schema, isValidObjectId } from "mongoose";
import type { Model } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

// Записи «ленты активности» у сделки, контакта и компании: заметки, комментарии, звонки, письма и т.д.
// Типы "stage" и "created" — системные, их создаёт сервер, через API их добавить нельзя.
export const USER_ACTIVITY_TYPES = [
    "activity", "comment", "task", "sms", "whatsapp", "telegram", "email", "note", "call", "schedule",
] as const;

export const ActivitySchema = new Schema({
    type: { type: String, required: true },
    text: { type: String, default: "" },
    meta: { type: String, default: "" }, // например, дата и время для запланированной активности
    createdAt: { type: Date, default: Date.now },
});

const MAX_TEXT = 2000;

// Фабрика обработчиков для маршрутов вида /api/<сущность>/[id]/activities
//   POST   { type, text, meta? }  — добавить запись, ответ: обновлённый документ
//   DELETE ?activityId=<id>       — удалить запись, ответ: обновлённый документ
export function activityHandlers(Entity: Model<any>) {
    type Ctx = { params: { id: string } };

    async function POST(req: Request, { params }: Ctx) {
        const user = await requireUser(req);
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

        let body: { type?: unknown; text?: unknown; meta?: unknown };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
        }

        const type = String(body.type ?? "");
        const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
        const meta = typeof body.meta === "string" ? body.meta.trim().slice(0, 100) : "";
        if (!(USER_ACTIVITY_TYPES as readonly string[]).includes(type)) {
            return NextResponse.json({ message: "Invalid activity type" }, { status: 400 });
        }
        if (!text) return NextResponse.json({ message: "Text is required" }, { status: 400 });

        await connectDB();
        const doc = await Entity.findOneAndUpdate(
            { _id: params.id, owner: user.id },
            { $push: { activities: { type, text, meta } } },
            { new: true }
        );
        if (!doc) return NextResponse.json({ message: "Not found" }, { status: 404 });
        return NextResponse.json(doc, { status: 201 });
    }

    async function DELETE(req: Request, { params }: Ctx) {
        const user = await requireUser(req);
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const activityId = new URL(req.url).searchParams.get("activityId") ?? "";
        if (!isValidObjectId(params.id) || !isValidObjectId(activityId)) {
            return NextResponse.json({ message: "Not found" }, { status: 404 });
        }

        await connectDB();
        const doc = await Entity.findOneAndUpdate(
            { _id: params.id, owner: user.id },
            { $pull: { activities: { _id: activityId } } },
            { new: true }
        );
        if (!doc) return NextResponse.json({ message: "Not found" }, { status: 404 });
        return NextResponse.json(doc);
    }

    return { POST, DELETE };
}

// Оставляет в объекте только перечисленные ключи со строковыми значениями (обрезает длину).
export function pickStrings(body: Record<string, unknown>, keys: readonly string[], max = 200) {
    const out: Record<string, string> = {};
    for (const key of keys) {
        if (typeof body[key] === "string") out[key] = (body[key] as string).trim().slice(0, max);
    }
    return out;
}
