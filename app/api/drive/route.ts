import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import Integration from "@/models/Integration";

export const dynamic = "force-dynamic";

// DELETE /api/drive — отключить Google Drive. Уже созданные документы остаются в CRM и на Диске, ссылки на них работают.
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized();
    await connectDB();
    await Integration.deleteOne({ owner: user.id, type: "gdrive" });
    return NextResponse.json({ ok: true });
}
