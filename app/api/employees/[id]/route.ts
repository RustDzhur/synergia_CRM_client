// app/api/employees/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { pickStrings } from "@/lib/activities";
import { EMPLOYEE_FIELDS } from "@/lib/crmFields";
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

    // только разрешённые поля (раньше в документ записывалось всё, кроме owner)
    const data = pickStrings(await req.json(), EMPLOYEE_FIELDS);
    for (const key of ["firstname", "lastname", "email"] as const) {
        if (key in data && !data[key]) return NextResponse.json({ message: `${key} is required` }, { status: 400 });
    }

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