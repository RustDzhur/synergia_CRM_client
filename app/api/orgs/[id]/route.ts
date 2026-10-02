import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { ACTIVITIES } from "@/config/firmActivities";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH /api/orgs/:id — { name } (переименовать) или { activities } (мастер «Чем занимается фирма»):
// меняет только владелец или администратор текущей фирмы.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id) || params.id !== user.id) return notFound(); // менять можно только ту фирму, в которой работаете сейчас
    if (user.role !== "owner" && user.role !== "admin") return NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });
    const body = await req.json().catch(() => null);
    const set: { name?: string; activities?: string[] } = {};
    if (typeof body?.name === "string") {
        const name = body.name.replace(/[\p{Cc}<>]/gu, "").trim().slice(0, 80);
        if (!name) return badRequest("Firm name is required");
        set.name = name;
    }
    if (Array.isArray(body?.activities)) {
        set.activities = body.activities.map((a: unknown) => String(a)).filter((a: string) => (ACTIVITIES as readonly string[]).includes(a)).slice(0, ACTIVITIES.length);
    }
    if (!Object.keys(set).length) return badRequest("name or activities is required");
    const org = await prisma.organization.update({ where: { id: params.id }, data: set }).catch(() => null);
    return org ? NextResponse.json({ id: org.id, name: org.name, activities: org.activities ?? [] }) : notFound();
}
