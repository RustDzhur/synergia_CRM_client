import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { destroyDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

// DELETE /api/demo — посетитель вышел из демо: его копия фирмы стирается целиком. Обычному пользователю — 403 (стереть чужое нельзя).
export async function DELETE(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!user.demo) return NextResponse.json({ message: "Not a demo account" }, { status: 403 });
    return NextResponse.json({ ok: await destroyDemo(user.userId) });
}
