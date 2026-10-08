import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/api";
import { CatalogError, createTemplate, listTemplatesAdmin } from "@/lib/office/catalogAdmin";

export const dynamic = "force-dynamic";

// GET /api/admin/robot-templates — весь каталог ролей роботов (с отключёнными и платформенными); только администратор платформы
export async function GET(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json({ templates: await listTemplatesAdmin() });
}

// POST /api/admin/robot-templates — новая роль { id, name, zone, accent, skills, duties, markets?, texts?, routines?, starter?, sort? }
export async function POST(req: Request) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await createTemplate(b), { status: 201 });
    } catch (e) {
        if (e instanceof CatalogError) return badRequest(e.message);
        throw e;
    }
}
