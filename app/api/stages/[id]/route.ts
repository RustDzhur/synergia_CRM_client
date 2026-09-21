import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import Stage from "@/models/Stage";
import Deal from "@/models/Deal";

// PATCH /api/stages/123 — переименовать / изменить порядок
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json();
    // только разрешённые поля: иначе через PATCH можно было записать в документ что угодно
    const data: Record<string, unknown> = {};
    for (const key of ["name", "order"]) {
        if (key in body) data[key] = body[key];
    }
    if (typeof body.color === "string") {
        // цвет — только "#RRGGBB" (или пустая строка = цвет по умолчанию)
        if (body.color !== "" && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
            return NextResponse.json({ message: "Invalid color" }, { status: 400 });
        }
        data.color = body.color;
    }

    await connectDB();
    const stage = await Stage.findOneAndUpdate(
        { _id: params.id, owner: user.id },
        { $set: data },
        { new: true }
    );

    if (!stage) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(stage);
}

// DELETE /api/stages/123 — удалить колонку целиком вместе со сделками в ней
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const stage = await Stage.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!stage) return NextResponse.json({ message: "Not found" }, { status: 404 });

    await Deal.deleteMany({ stage: params.id, owner: user.id });
    return NextResponse.json({ ok: true });
}