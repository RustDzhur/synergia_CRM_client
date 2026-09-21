import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { rateLimited } from "@/lib/rateLimit";
import { serverError } from "@/lib/api";
import ContactMessage from "@/models/ContactMessage";

export const dynamic = "force-dynamic";

// POST /api/contact — { name, email, phone?, message, locale? }: публичная форма «Contact» на сайте.
// Обращения сохраняются в коллекцию contactmessages (смотреть в MongoDB Atlas). Не более 5 отправок в час с одного адреса.
export async function POST(req: Request) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (rateLimited(`contact:${ip}`, 5, 60 * 60 * 1000)) return NextResponse.json({ message: "Too many messages" }, { status: 429 });

    const b = await req.json().catch(() => null);
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const name = str(b?.name, 100);
    const email = str(b?.email, 200).toLowerCase();
    const phone = str(b?.phone, 40);
    const message = str(b?.message, 3000);
    const locale = ["en", "de", "ua"].includes(b?.locale) ? b.locale : "en";
    if (!name || !message || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ message: "Invalid data" }, { status: 400 });

    try {
        await connectDB();
        await ContactMessage.create({ name, email, phone, message, locale });
        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
        return serverError(e);
    }
}
