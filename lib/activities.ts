import { NextResponse } from "next/server";
import { Schema } from "mongoose";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { toDTO } from "@/lib/serialize";

// Записи «ленты активности» у сделки, контакта и компании: заметки, комментарии, звонки, письма и т.д.
// Типы "stage" и "created" — системные, их создаёт сервер, через API их добавить нельзя.
export const USER_ACTIVITY_TYPES = [
    "activity", "comment", "task", "sms", "viber", "telegram", "email", "note", "call", "schedule",
] as const;

// Остаётся Mongoose-схемой до тех пор, пока не переведены модели Contact/Deal/Task/Company,
// которые вкладывают её в поле activities.
export const ActivitySchema = new Schema({
    type: { type: String, required: true },
    text: { type: String, default: "" },
    meta: { type: String, default: "" }, // например, дата и время для запланированной активности
    createdAt: { type: Date, default: Date.now },
});

const MAX_TEXT = 2000;

// Фабрика обработчиков для маршрутов вида /api/<сущность>/[id]/activities. Принимает имя Prisma-модели.
//   POST   { type, text, meta? }  — добавить запись, ответ: обновлённый документ
//   DELETE ?activityId=<id>       — удалить запись, ответ: обновлённый документ
export function activityHandlers(model: "contact" | "task" | "deal" | "company") {
    const delegate = prisma[model] as any;
    type Ctx = { params: { id: string } };

    async function POST(req: Request, { params }: Ctx) {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);
        if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

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

        const doc = await delegate.findFirst({ where: { id: params.id, owner: user.id } });
        if (!doc) return NextResponse.json({ message: "Not found" }, { status: 404 });
        const activities = Array.isArray(doc.activities) ? doc.activities : [];
        activities.push({ _id: randomUUID(), type, text, meta, createdAt: new Date().toISOString() });
        const updated = await delegate.update({ where: { id: params.id }, data: { activities } });
        return NextResponse.json(toDTO(updated), { status: 201 });
    }

    async function DELETE(req: Request, { params }: Ctx) {
        const user = await requireUser(req);
        if (!user) return unauthorized(req);

        const activityId = new URL(req.url).searchParams.get("activityId") ?? "";
        if (!validId(params.id) || !validId(activityId)) {
            return NextResponse.json({ message: "Not found" }, { status: 404 });
        }

        const doc = await delegate.findFirst({ where: { id: params.id, owner: user.id } });
        if (!doc) return NextResponse.json({ message: "Not found" }, { status: 404 });
        const activities = Array.isArray(doc.activities) ? doc.activities.filter((a: any) => String(a?._id) !== activityId) : [];
        const updated = await delegate.update({ where: { id: params.id }, data: { activities } });
        return NextResponse.json(toDTO(updated));
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
