// app/api/contacts/[id]/route.ts
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import Contact from "@/models/Contact";
import { CONTACT_FIELDS, contactFullName } from "@/lib/crmFields";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    await connectDB();
    const contact = await Contact.findOne({ _id: params.id, owner: user.id });
    if (!contact) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json(contact);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, string> = pickStrings(body, CONTACT_FIELDS);
    if ("firstName" in data || "lastName" in data || typeof body.name === "string") {
        const name = contactFullName(data, body.name);
        if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });
        data.name = name;
    }

    await connectDB();
    const contact = await Contact.findOneAndUpdate(
        { _id: params.id, owner: user.id },
        { $set: data },
        { new: true }
    );

    if (!contact) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(contact);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    await connectDB();
    const contact = await Contact.findOneAndDelete({ _id: params.id, owner: user.id });

    if (!contact) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
