import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { systemCheck } from "@/lib/systemCheck";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/admin/system — проверка настройки платформы (база, Stripe, Firebase, Google, переменные окружения); только администратор
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json(await systemCheck());
}
