import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { pickStrings } from "@/lib/activities";
import { COMPANY_FIELDS } from "@/lib/crmFields";
import Company from "@/models/Company";

// GET /api/companies — список компаний-клиентов текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const companies = await Company.find({ owner: user.id }).sort({ createdAt: -1 });
    return NextResponse.json(companies);
}

// POST /api/companies — создать компанию
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const fields = pickStrings(await req.json(), COMPANY_FIELDS);
    if (!fields.name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    await connectDB();
    const company = await Company.create({ ...fields, owner: user.id });
    return NextResponse.json(company, { status: 201 });
}
