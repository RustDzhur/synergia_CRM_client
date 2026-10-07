import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { serverStats } from "@/lib/serverStats";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/admin/server — нагрузка и свободное место сервера (процессор, память, диск, база, файлы); только администратор
export async function GET(req: Request) {
    const admin = await requirePlatformAdmin(req);
    if (!admin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json(await serverStats());
}
