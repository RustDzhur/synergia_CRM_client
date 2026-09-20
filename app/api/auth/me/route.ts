import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import User from "@/models/User";

function toPublic(user: any) {
    return {
        id: user._id.toString(),
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        avatarUrl: user.avatarUrl ?? "",
        phone: user.phone ?? "",
        position: user.position ?? "",
        city: user.city ?? "",
        country: user.country ?? "",
        role: user.role ?? "",
        department: user.department ?? "",
        postCode: user.postCode ?? "",
        languages: user.languages ?? "",
        timezone: user.timezone ?? "",
        state: user.state ?? "",
        company: user.company ?? "",
        notifications: {
            browser: Boolean(user.notifications?.browser),
            email: Boolean(user.notifications?.email),
            muteEmail: Boolean(user.notifications?.muteEmail),
            muteFrom: user.notifications?.muteFrom || "10:00",
            muteTo: user.notifications?.muteTo || "10:00",
        },
    };
}

// GET /api/auth/me — текущий пользователь
export async function GET(req: Request) {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
        await connectDB();
        const user = await User.findById(sub);
        if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        return NextResponse.json(toPublic(user));
    } catch {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
}

const TEXT_FIELDS = [
    "firstname", "lastname", "phone", "position", "city", "country",
    "role", "department", "postCode", "languages", "timezone", "state", "company",
] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const REQUIRED_FIELDS = ["firstname", "lastname"];
const MAX_TEXT_LENGTH = 100;
const MAX_AVATAR_LENGTH = 300_000; // ~220 КБ картинки в base64; клиент сжимает до 256×256 (~30 КБ)
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

// PATCH /api/auth/me — изменить свой профиль. Принимаются только поля из белого списка;
// email, пароль и т.п. отсюда менять нельзя.
export async function PATCH(req: Request) {
    const auth = await requireUser(req);
    if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
    }

    const update: Record<string, string | boolean> = {};

    for (const key of TEXT_FIELDS) {
        if (typeof body[key] !== "string") continue;
        const value = (body[key] as string).trim().slice(0, MAX_TEXT_LENGTH);
        if (REQUIRED_FIELDS.includes(key) && !value) {
            return NextResponse.json({ message: `${key} is required` }, { status: 400 });
        }
        update[key] = value;
    }

    if (typeof body.avatarUrl === "string") {
        const avatar = body.avatarUrl;
        const valid = avatar === "" || (avatar.length <= MAX_AVATAR_LENGTH && AVATAR_PATTERN.test(avatar));
        if (!valid) return NextResponse.json({ message: "Invalid avatar" }, { status: 400 });
        update.avatarUrl = avatar;
    }

    // настройки уведомлений: только известные поля и только нужных типов
    const prefs = body.notifications;
    if (prefs && typeof prefs === "object") {
        const p = prefs as Record<string, unknown>;
        for (const key of ["browser", "email", "muteEmail"] as const) {
            if (typeof p[key] === "boolean") update[`notifications.${key}`] = p[key] as boolean;
        }
        for (const key of ["muteFrom", "muteTo"] as const) {
            if (typeof p[key] !== "string") continue;
            if (!TIME_PATTERN.test(p[key] as string)) return NextResponse.json({ message: `${key} must be HH:MM` }, { status: 400 });
            update[`notifications.${key}`] = p[key] as string;
        }
    }

    await connectDB();
    const user = await User.findByIdAndUpdate(auth.id, { $set: update }, { new: true });
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    return NextResponse.json(toPublic(user));
}
