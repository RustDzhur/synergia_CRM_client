import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import User from "@/models/User";

const MIN_LENGTH = 8; // как при регистрации (api/auth/signup)
const MAX_LENGTH = 128;

// POST /api/auth/password { currentPassword, newPassword } — смена своего пароля.
// Старый пароль проверяется на сервере: одного действующего токена для смены недостаточно.
export async function POST(req: Request) {
    const auth = await requireUser(req);
    if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    let body: { currentPassword?: unknown; newPassword?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }
    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (next.length < MIN_LENGTH || next.length > MAX_LENGTH) {
        return NextResponse.json({ message: "weak_password" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findById(auth.id);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!(await bcrypt.compare(current, user.passwordHash))) {
        return NextResponse.json({ message: "wrong_password" }, { status: 403 });
    }

    user.passwordHash = await bcrypt.hash(next, 12);
    await user.save();
    return NextResponse.json({ ok: true });
}
