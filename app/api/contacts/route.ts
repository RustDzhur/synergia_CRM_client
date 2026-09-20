import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import Contact from "@/models/Contact";

// GET /api/contacts — список всех контактов текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const contacts = await Contact.find({ owner: user.id }).sort({ createdAt: -1 });
    return NextResponse.json(contacts);
}

// POST /api/contacts — создать контакт
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    if (!data.name) {
        return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    await connectDB();
    const contact = await Contact.create({ ...data, owner: user.id });
    return NextResponse.json(contact, { status: 201 });
}