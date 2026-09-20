// app/api/employees/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import Employee from "@/models/Employee";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const employee = await Employee.findOne({ _id: params.id, owner: user.id });
    if (!employee) return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json(employee);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    delete data.owner;

    await connectDB();
    const employee = await Employee.findOneAndUpdate(
        { _id: params.id, owner: user.id },
        { $set: data },
        { new: true }
    );

    if (!employee) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(employee);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const employee = await Employee.findOneAndDelete({ _id: params.id, owner: user.id });

    if (!employee) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}