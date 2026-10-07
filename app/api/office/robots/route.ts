import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { officeFailure } from "@/lib/office/api";
import { createRobot } from "@/lib/office/store";

export const dynamic = "force-dynamic";

// POST /api/office/robots — нанять робота: { template } из каталога или своего { name, title, skills, instructions, zone, accent, autonomy }
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return badRequest("Invalid body");
    try {
        return NextResponse.json(await createRobot(user.id, b), { status: 201 });
    } catch (e) {
        return officeFailure(e);
    }
}
