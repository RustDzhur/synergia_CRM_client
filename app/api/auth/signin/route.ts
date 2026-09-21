import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { serverError } from "@/lib/api";
import User from "@/models/User";

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();
        if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
        await connectDB();
        const user = await User.findOne({ email: String(email ?? "").toLowerCase() });
        const ok = user && (await bcrypt.compare(String(password ?? ""), user.passwordHash));
        if (!ok) {
            return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
        }
        const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        return NextResponse.json({ token });
    } catch (e) {
        return serverError(e);
    }
}
