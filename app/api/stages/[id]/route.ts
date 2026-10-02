import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";

// PATCH /api/stages/123 — переименовать / изменить порядок
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json();
    // только разрешённые поля: иначе через PATCH можно было записать в документ что угодно
    const data: { name?: string; order?: number; color?: string } = {};
    for (const key of ["name", "order"] as const) {
        if (key in body) (data as Record<string, unknown>)[key] = body[key];
    }
    if (typeof body.color === "string") {
        // цвет — только "#RRGGBB" (или пустая строка = цвет по умолчанию)
        if (body.color !== "" && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
            return NextResponse.json({ message: "Invalid color" }, { status: 400 });
        }
        data.color = body.color;
    }

    const r = await prisma.stage.updateMany({ where: { id: params.id, owner: user.id }, data });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const stage = await prisma.stage.findUnique({ where: { id: params.id } });
    return NextResponse.json(toDTO(stage!));
}

// DELETE /api/stages/123 — удалить колонку целиком вместе со сделками в ней
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const r = await prisma.stage.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });

    await prisma.deal.deleteMany({ where: { stage: params.id, owner: user.id } });
    return NextResponse.json({ ok: true });
}
