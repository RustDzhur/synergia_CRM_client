import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import AiLog from "@/models/AiLog";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET /api/ai/log — журнал действий ИИ фирмы (последние 100); только владелец и администратор
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!["owner", "admin"].includes(user.role)) return NextResponse.json({ message: "You have no access to this section", code: "forbidden" }, { status: 403 });
    await connectDB();
    const rows = await AiLog.find({ org: user.id }).sort({ createdAt: -1 }).limit(100).lean();
    const users = await User.find({ _id: { $in: Array.from(new Set(rows.map((r) => String(r.user)))) } }).select("firstname lastname").lean();
    const name = new Map(users.map((u) => [String(u._id), `${u.firstname} ${u.lastname}`.trim()]));
    return NextResponse.json(rows.map((r) => ({ at: r.createdAt.toISOString(), user: name.get(String(r.user)) ?? "", kind: r.kind, tool: r.tool, args: r.args, result: r.result })));
}
