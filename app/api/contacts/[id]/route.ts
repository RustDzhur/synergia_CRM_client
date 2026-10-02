// app/api/contacts/[id]/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { prisma } from "@/lib/prisma";
import { toDTO } from "@/lib/serialize";
import { CONTACT_FIELDS, contactFullName } from "@/lib/crmFields";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const contact = await prisma.contact.findUnique({ where: { id: params.id } });
    if (!contact || contact.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json(toDTO(contact));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, string> = pickStrings(body, CONTACT_FIELDS);
    if ("firstName" in data || "lastName" in data || typeof body.name === "string") {
        const name = contactFullName(data, body.name);
        if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });
        data.name = name;
    }

    const existing = await prisma.contact.findUnique({ where: { id: params.id } });
    if (!existing || existing.owner !== user.id) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const contact = await prisma.contact.update({ where: { id: params.id }, data: data as any });
    return NextResponse.json(toDTO(contact));
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const r = await prisma.contact.deleteMany({ where: { id: params.id, owner: user.id } });
    if (!r.count) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
