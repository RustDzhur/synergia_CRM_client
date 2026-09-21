import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { CONTACT_FIELDS, contactFullName } from "@/lib/crmFields";
import Contact from "@/models/Contact";

// GET /api/contacts — список всех контактов текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const contacts = await Contact.find({ owner: user.id }).sort({ createdAt: -1 });
    return NextResponse.json(contacts);
}

// POST /api/contacts — создать контакт
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json();
    const fields = pickStrings(body, CONTACT_FIELDS);
    const name = contactFullName(fields, body.name);
    if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    await connectDB();
    const contact = await Contact.create({ ...fields, name, owner: user.id });
    return NextResponse.json(contact, { status: 201 });
}
