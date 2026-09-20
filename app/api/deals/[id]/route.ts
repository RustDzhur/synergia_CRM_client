import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import Deal from "@/models/Deal";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await req.json(); // { stage, order, clientName } — любое из этого
    // только разрешённые поля: иначе через PATCH можно было записать в документ что угодно
    const data: Record<string, unknown> = {};
    for (const key of ["stage", "order", "clientName"]) {
        if (key in body) data[key] = body[key];
    }

    await connectDB();
    const deal = await Deal.findOneAndUpdate(
        { _id: params.id, owner: user.id },
        { $set: data },
        { new: true }
    );

    if (!deal) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(deal);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const deal = await Deal.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!deal) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
}