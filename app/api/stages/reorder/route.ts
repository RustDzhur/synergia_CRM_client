import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && validId(id))) {
        return NextResponse.json({ message: "ids must be an array of stage ids" }, { status: 400 });
    }

    await prisma.$transaction(
        (ids as string[]).map((id, index) => prisma.stage.updateMany({ where: { id, owner: user.id }, data: { order: index } }))
    );

    return NextResponse.json({ ok: true });
}
