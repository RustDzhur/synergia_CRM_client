import { NextResponse } from "next/server";
import { setCodeActive } from "@/lib/partner/service";
import { withPartner } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// PATCH { active } — включить или выключить код
export const PATCH = withPartner(async (req, { partner }, params) => {
    const b = await req.json().catch(() => null);
    if (!b || typeof b.active !== "boolean") return NextResponse.json({ message: "active is required" }, { status: 400 });
    await setCodeActive(partner.id, params.id, b.active);
    return NextResponse.json({ ok: true });
});
