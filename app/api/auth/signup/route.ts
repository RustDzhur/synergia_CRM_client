import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { serverError } from "@/lib/api";
import User from "@/models/User";

export async function POST(req: Request) {
    try {
        const { firstname, lastname, email, password } = await req.json();
        if (!firstname || !lastname || !email || !password || String(password).length < 8) {
            return NextResponse.json({ message: "Invalid data" }, { status: 400 });
        }
        await connectDB();
        const normalized = String(email).toLowerCase();
        if (await User.findOne({ email: normalized })) {
            return NextResponse.json({ message: "Email already in use" }, { status: 409 });
        }
        const passwordHash = await bcrypt.hash(String(password), 12);
        await User.create({ firstname, lastname, email: normalized, passwordHash });
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
        return serverError(e);
    }
}
