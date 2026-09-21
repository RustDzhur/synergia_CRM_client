import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

// POST /api/notifications/read — { ids: string[] } или { all: true }: отметить прочитанным (только для себя)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => ({}));
    await connectDB();
    const filter: Record<string, unknown> = { org: user.id, readBy: { $ne: user.userId } };
    if (!b?.all) filter._id = { $in: (Array.isArray(b?.ids) ? b.ids : []).filter((i: unknown) => typeof i === "string" && isValidObjectId(i)) };
    await Notification.updateMany(filter, { $addToSet: { readBy: user.userId } });
    return NextResponse.json({ ok: true });
}
