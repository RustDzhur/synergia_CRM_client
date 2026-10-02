// app/api/employees/[id]/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { EMPLOYEE_FIELDS } from "@/lib/crmFields";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const employee = await prisma.employee.findFirst({ where: { id: params.id, owner: user.id } });
    if (!employee) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json(toDTO(employee));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    // только разрешённые поля (раньше в документ записывалось всё, кроме owner)
    const data = pickStrings(await req.json(), EMPLOYEE_FIELDS);
    for (const key of ["firstname", "lastname", "email"] as const) {
        if (key in data && !data[key]) return NextResponse.json({ message: `${key} is required` }, { status: 400 });
    }

    const existing = await prisma.employee.findFirst({ where: { id: params.id, owner: user.id } });
    if (!existing) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const employee = await prisma.employee.update({ where: { id: params.id }, data: data as any });
    return NextResponse.json(toDTO(employee));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const r = await prisma.employee.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
