import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import Employee from "@/models/Employee";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    const page = Number(searchParams.get("page") ?? 1);
    const limit = 20;
    const filter: any = { owner: user.id };
    if (q) filter.$or = [
        { firstname: { $regex: q, $options: "i" } },
        { lastname: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
    ];
    const [items, total] = await Promise.all([
        Employee.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Employee.countDocuments(filter),
    ]);
    return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const data = await req.json();
    if (!data.firstname || !data.lastname || !data.email) {
        return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    }
    await connectDB();
    const employee = await Employee.create({ ...data, owner: user.id });
    return NextResponse.json(employee, { status: 201 });
}