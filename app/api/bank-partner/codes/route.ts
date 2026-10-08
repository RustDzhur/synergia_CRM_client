import { NextResponse } from "next/server";
import { createCode } from "@/lib/partner/service";
import { withPartner } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// POST { label } — новый код для ссылки /partner/<код>
export const POST = withPartner(async (req, { partner }) => {
    const b = await req.json().catch(() => ({}));
    const c = await createCode(partner.id, b?.label);
    return NextResponse.json({ id: c.id, code: c.code, label: c.label }, { status: 201 });
});
