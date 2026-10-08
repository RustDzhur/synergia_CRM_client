import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { badRequest } from "@/lib/api";
import { CatalogError, removeTemplate, updateTemplate } from "@/lib/office/catalogAdmin";

export const dynamic = "force-dynamic";

// PATCH — правка роли (в том числе active: false — снять с найма); DELETE — удалить свою роль или отключить встроенную
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await updateTemplate(params.id, b));
    } catch (e) {
        if (e instanceof CatalogError) return badRequest(e.message);
        throw e;
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    if (!(await requirePlatformAdmin(req))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    try {
        return NextResponse.json({ result: await removeTemplate(params.id) });
    } catch (e) {
        if (e instanceof CatalogError) return badRequest(e.message);
        throw e;
    }
}
