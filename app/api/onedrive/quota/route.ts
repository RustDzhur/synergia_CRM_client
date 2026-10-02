import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { findOnedrive, onedriveQuota, onedriveToken } from "@/lib/onedrive";

export const dynamic = "force-dynamic";

// GET /api/onedrive/quota — сколько места занято и выделено на подключённом OneDrive.
// Отдельным запросом, как у Google Диска: это обращение к Microsoft, и оно нужно только на вкладке OneDrive.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
            const drive = await findOnedrive(user.id);
        if (!drive || drive.status !== "connected") return NextResponse.json({ connected: false });
        const quota = await onedriveQuota(await onedriveToken(drive));
        return NextResponse.json({ connected: true, ...quota });
    } catch (e) {
        return failure(e);
    }
}
