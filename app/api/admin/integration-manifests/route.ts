import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { listManifests } from "@/lib/integrations/manifests";

export const dynamic = "force-dynamic";

// GET /api/admin/integration-manifests — реестр паспортов с накладкой из базы; только администратор платформы
export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json({ manifests: await listManifests() });
}
