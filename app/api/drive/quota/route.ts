import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { driveToken, findDrive } from "@/lib/google";
import { driveQuota } from "@/lib/google/drive";

export const dynamic = "force-dynamic";

// GET /api/drive/quota — сколько места выделено и занято на подключённом Google Диске.
// Отдельным запросом, а не вместе со списком документов: это обращение к Google, и оно нужно
// только на вкладке «Google Диск», а не при каждом открытии раздела.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    try {
        await connectDB();
        const drive = await findDrive(user.id);
        if (!drive || drive.status !== "connected") return NextResponse.json({ connected: false });
        const quota = await driveQuota(await driveToken(drive));
        return NextResponse.json({ connected: true, ...quota });
    } catch (e) {
        return failure(e);
    }
}
