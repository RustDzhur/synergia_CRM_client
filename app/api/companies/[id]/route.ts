import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { pickStrings } from "@/lib/activities";
import Company from "@/models/Company";
import { COMPANY_FIELDS } from "@/lib/crmFields";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    await connectDB();
    const company = await Company.findOne({ _id: params.id, owner: user.id });
    if (!company) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(company);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!isValidObjectId(params.id)) return NextResponse.json({ message: "Not found" }, { status: 404 });

    const data = pickStrings(await req.json(), COMPANY_FIELDS);
    if ("name" in data && !data.name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

    await connectDB();
    const company = await Company.findOneAndUpdate({ _id: params.id, owner: user.id }, { $set: data }, { new: true });
    if (!company) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(company);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectDB();
    const company = await Company.findOneAndDelete({ _id: params.id, owner: user.id });
    if (!company) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
}
