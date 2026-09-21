import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { serverError } from "@/lib/api";
import Invitation from "@/models/Invitation";
import Membership from "@/models/Membership";
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
        const created = await User.create({ firstname, lastname, email: normalized, passwordHash });
        // приглашён в фирму до регистрации — доступ появляется сразу
        const invites = await Invitation.find({ email: normalized, expiresAt: { $gt: new Date() } });
        for (const inv of invites) await Membership.updateOne({ org: inv.org, user: created._id }, { $setOnInsert: { role: inv.role, modules: inv.modules } }, { upsert: true });
        if (invites.length) await Invitation.deleteMany({ email: normalized });
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
        return serverError(e);
    }
}
