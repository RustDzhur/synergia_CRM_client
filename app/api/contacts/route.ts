import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { CONTACT_FIELDS, contactFullName } from "@/lib/crmFields";
import { cleanExtra, mergeExtra } from "@/lib/finance/contractFields";
import { emit } from "@/lib/automation/emit";
import { resolveContactCompany } from "@/lib/sync/customer";
import { prisma } from "@/lib/prisma";
import { toDTO, toDTOs } from "@/lib/serialize";

// GET /api/contacts — список всех контактов текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const contacts = await prisma.contact.findMany({ where: { owner: user.id }, orderBy: { createdAt: "desc" } });
    return NextResponse.json(toDTOs(contacts));
}

// POST /api/contacts — создать контакт
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json();
    const fields = pickStrings(body, CONTACT_FIELDS);
    const name = contactFullName(fields, body.name);
    if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    const link = await resolveContactCompany(user.id, { companyId: body.companyId, company: fields.company });
    const extra = body && typeof body === "object" && "extra" in body ? { extra: mergeExtra({}, cleanExtra(body.extra)) } : {};
    const contact = await prisma.contact.create({ data: { ...fields, ...(link ?? {}), ...extra, name, owner: user.id } as any });
    await emit(user.id, { type: "contact_created", data: { id: contact.id, name: contact.name, email: contact.email ?? "", phone: contact.phone ?? "" } });
    return NextResponse.json(toDTO(contact), { status: 201 });
}
