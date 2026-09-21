import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, failure, unauthorized } from "@/lib/api";
import { connectPasswordAccount, toMailAccountDTO } from "@/lib/mail";
import { oauthAvailable } from "@/lib/mail/oauth";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/mail/accounts — подключённые ящики и доступные способы входа через OAuth
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    await connectDB();
    const list = await Integration.find({ owner: user.id, type: "mail" }).sort({ createdAt: 1 });
    return NextResponse.json({ accounts: list.map(toMailAccountDTO), oauth: oauthAvailable() });
}

// POST /api/mail/accounts — { provider, email, password, imapHost?, imapPort?, smtpHost?, smtpPort? }
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    const body = await req.json().catch(() => null);
    if (!body) return badRequest("Invalid body");
    try {
        await connectDB();
        const doc = await connectPasswordAccount(user.id, body);
        return NextResponse.json(toMailAccountDTO(doc), { status: 201 });
    } catch (e) {
        return failure(e);
    }
}
