import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import Stage from "@/models/Stage";

// POST /api/stages/reorder  { ids: ["<id первой колонки>", "<id второй>", ...] }
// Записывает order = позиция в массиве. Чужие и несуществующие id просто не обновятся.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    let ids: unknown;
    try {
        ({ ids } = await req.json());
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && isValidObjectId(id))) {
        return NextResponse.json({ message: "ids must be an array of stage ids" }, { status: 400 });
    }

    await connectDB();
    await Stage.bulkWrite(
        (ids as string[]).map((id, index) => ({
            updateOne: { filter: { _id: id, owner: user.id }, update: { $set: { order: index } } },
        }))
    );

    return NextResponse.json({ ok: true });
}
