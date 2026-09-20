import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: Request) {
    const { email, password } = await req.json();
    await connectDB();
    const user = await User.findOne({ email: String(email ?? "").toLowerCase() });
    const ok = user && (await bcrypt.compare(String(password ?? ""), user.passwordHash));
    if (!ok) {
        return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }
    const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET as string, {
        expiresIn: "7d",
    });
    return NextResponse.json({ token });
}