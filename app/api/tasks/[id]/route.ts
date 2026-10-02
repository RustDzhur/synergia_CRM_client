import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { TASK_TEXT_FIELDS } from "@/lib/crmFields";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = pickStrings(body, TASK_TEXT_FIELDS, 500);
    if ("title" in data && !data.title) return NextResponse.json({ message: "Title is required" }, { status: 400 });
    for (const flag of ["completed", "pinned", "muted"] as const) {
        if (typeof body[flag] === "boolean") data[flag] = body[flag];
    }

    // привязку к проекту проверяем отдельно: чужой проект привязать нельзя, а пустая строка снимает привязку
    if ("project" in body) {
        const id = body.project;
        if (typeof id === "string" && id) {
            const owned = await prisma.project.findFirst({ where: { id, owner: user.id }, select: { id: true } }).catch(() => null);
            if (!owned) return NextResponse.json({ message: "Project not found" }, { status: 400 });
            data.project = owned.id;
        } else {
            data.project = null;
        }
    }
    const existing = await prisma.task.findUnique({ where: { id: params.id } });
    if (!existing || existing.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const task = await prisma.task.update({ where: { id: params.id }, data: data as any });
    return NextResponse.json(toDTO(task));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const r = await prisma.task.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
