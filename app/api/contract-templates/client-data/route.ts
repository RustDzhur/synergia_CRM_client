import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/api";
import { customerValues } from "@/lib/finance/contractVars";
import { financeSettings } from "@/lib/finance/settings";
import { firmValues } from "@/lib/finance/contractVars";
import { partyVars } from "@/lib/finance/contractFields";
import { validId } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/contract-templates/client-data?contact=&company=&name= — значения реквизитов клиента из его карточек (контакт и/или компания)
// и реквизиты нашей фирмы: форма договора показывает, что подставится само, а чего не хватает.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const q = new URL(req.url).searchParams;
    const customer = await customerValues(user.id, { contact: q.get("contact") || undefined, company: q.get("company") || undefined, customerName: q.get("name") || "" });
    const firm = firmValues(await financeSettings(user.id));
    const name = customer.__name;
    delete customer.__name;
    // свободные реквизиты карточек (в том числе собственные поля шаблонов): компания, поверх неё — контакт
    const extra: Record<string, string> = {};
    const cid = q.get("company"), pid = q.get("contact");
    const [co, ct] = await Promise.all([
        cid && validId(cid) ? prisma.company.findFirst({ where: { id: cid, owner: user.id }, select: { extra: true } }) : null,
        pid && validId(pid) ? prisma.contact.findFirst({ where: { id: pid, owner: user.id }, select: { extra: true } }) : null,
    ]);
    for (const src of [co?.extra, ct?.extra]) if (src && typeof src === "object" && !Array.isArray(src)) for (const [k, v] of Object.entries(src)) if (typeof v === "string" && v) extra[k] = v;
    return NextResponse.json({ customer, firm, extra, vars: { ...partyVars("firm", firm), ...partyVars("customer", customer), customer: name || customer.companyName || customer.fullName || "" } });
}
