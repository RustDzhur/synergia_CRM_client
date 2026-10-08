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

// DELETE /api/stages/123?moveTo=<id> — удалить колонку. Карточки из неё не удаляются: их нужно перенести в другую колонку
// (moveTo). Непустую колонку без moveTo удалить нельзя: раньше вместе с колонкой молча удалялись все её сделки,
// а задачи, счета и расходы этих сделок оставались со ссылкой на несуществующую запись.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const stage = await prisma.stage.findFirst({ where: { id: params.id, owner: user.id } });
    if (!stage) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const count = await prisma.deal.count({ where: { owner: user.id, stage: stage.id } });
    if (count > 0) {
        const moveTo = new URL(req.url).searchParams.get("moveTo") ?? "";
        const target = moveTo && moveTo !== stage.id ? await prisma.stage.findFirst({ where: { id: moveTo, owner: user.id } }) : null;
        if (!target) return NextResponse.json({ message: "The column has cards: choose a column to move them to", code: "stage_not_empty", count }, { status: 409 });
        // переносимые карточки встают в конец целевой колонки в прежнем порядке
        const start = await prisma.deal.count({ where: { owner: user.id, stage: target.id } });
        const moving = await prisma.deal.findMany({ where: { owner: user.id, stage: stage.id }, orderBy: { order: "asc" }, select: { id: true } });
        await prisma.$transaction([
            ...moving.map((d, i) => prisma.deal.update({ where: { id: d.id }, data: { stage: target.id, order: start + i, wonAt: null } })),
            prisma.stage.deleteMany({ where: { id: stage.id, owner: user.id } }),
        ]);
        return NextResponse.json({ ok: true, moved: moving.length, to: target.id });
    }
    await prisma.stage.deleteMany({ where: { id: stage.id, owner: user.id } });
    return NextResponse.json({ ok: true, moved: 0 });
}
