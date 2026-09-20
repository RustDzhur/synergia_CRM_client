import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: Request) {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
        await connectDB();
        const user = await User.findById(sub);
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        return NextResponse.json({
            id: user._id.toString(),
            firstname: user.firstname,
            lastname: user.lastname,
            avatarUrl: user.avatarUrl,
        });
    } catch {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
}