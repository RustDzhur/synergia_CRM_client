// app/api/contacts/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import Contact from "@/models/Contact";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const contact = await Contact.findOne({ _id: params.id, owner: user.id });
    if (!contact) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json(contact);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    delete data.owner;

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
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const contact = await Contact.findOneAndDelete({ _id: params.id, owner: user.id });

    if (!contact) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}