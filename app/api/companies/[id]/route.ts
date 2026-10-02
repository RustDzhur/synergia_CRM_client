import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { COMPANY_FIELDS } from "@/lib/crmFields";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const company = await prisma.company.findUnique({ where: { id: params.id } });
    if (!company || company.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(toDTO(company));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const data = pickStrings(await req.json(), COMPANY_FIELDS);
    if ("name" in data && !data.name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    const existing = await prisma.company.findUnique({ where: { id: params.id } });
    if (!existing || existing.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });
    const company = await prisma.company.update({ where: { id: params.id }, data: data as any });
    return NextResponse.json(toDTO(company));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const r = await prisma.company.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
