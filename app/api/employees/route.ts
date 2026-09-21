import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { pickStrings } from "@/lib/activities";
import { EMPLOYEE_FIELDS, escapeRegex } from "@/lib/crmFields";
import Employee from "@/models/Employee";

export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const { searchParams } = new URL(req.url);
    const q = escapeRegex((searchParams.get("q") ?? "").slice(0, 100)); // поиск — это текст, а не шаблон регулярного выражения
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
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
    return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const data = pickStrings(await req.json(), EMPLOYEE_FIELDS);
    if (!data.firstname || !data.lastname || !data.email) {
        return NextResponse.json({ message: "Invalid data" }, { status: 400 });
    }
    await connectDB();
    const employee = await Employee.create({ ...data, owner: user.id });
    return NextResponse.json(employee, { status: 201 });
}
