import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { findOnedrive, listOnedrive, onedriveToken } from "@/lib/onedrive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/onedrive/files[?folder=id] — что лежит в OneDrive пользователя: корень или содержимое папки.
// Нужен, чтобы выбрать файлы для переноса, а не тянуть весь диск целиком.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
            const drive = await findOnedrive(user.id);
        if (!drive || drive.status !== "connected") return NextResponse.json({ message: "Connect OneDrive first", code: "not_connected" }, { status: 409 });
        const folder = new URL(req.url).searchParams.get("folder") ?? "";
        const files = await listOnedrive(await onedriveToken(drive), folder);
        return NextResponse.json({ files });
    } catch (e) {
        return failure(e);
    }
}
