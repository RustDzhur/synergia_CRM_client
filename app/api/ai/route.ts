import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { aiConfigured } from "@/lib/ai/provider";
import { dailyLimit, usedToday } from "@/lib/ai/run";
import { allowedTools } from "@/lib/ai/tools";

export const dynamic = "force-dynamic";

// GET /api/ai — включён ли ИИ на сайте, сколько запросов осталось сегодня и что ему разрешено этому пользователю
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    await connectDB();
    const [limit, used] = await Promise.all([dailyLimit(user.id), usedToday(user.id)]);
    const tools = allowedTools(user);
    return NextResponse.json({ configured: aiConfigured(), limit, remaining: Math.max(0, limit - used), canWrite: tools.some((t) => t.write), tools: tools.map((t) => ({ name: t.def.name, write: t.write })) });
}
