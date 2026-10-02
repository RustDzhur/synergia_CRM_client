import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import { toContractDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";

// POST /api/contracts/:id/sign — договор подписан клиентом: draft → active + событие contract_signed. С этого события
// правилом автоматизации можно поднять задачу "закупить материалы", создать заказ, сдвинуть сделку и т.п.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const found = await prisma.contract.findFirst({ where: { id: params.id, org: user.id } });
    if (!found) return notFound();
    if (found.status !== "draft") return badRequest("Only a draft contract can be signed");
    const c = await prisma.contract.update({ where: { id: found.id }, data: { status: "active", signedAt: new Date() } });
    await emit(user.id, { type: "contract_signed", data: { id: c.id, number: c.number, customerName: c.customerName, value: String(c.value), currency: c.currency, dealId: c.deal ?? "" } });
    await logAudit({ org: user.id, userId: user.userId, action: "contract.signed", entityType: "contract", entityId: c.id, summary: `Contract ${c.number} signed by ${c.customerName} — ${c.value} ${c.currency}`, meta: { value: c.value, currency: c.currency } });
    return NextResponse.json(toContractDTO(c));
}
