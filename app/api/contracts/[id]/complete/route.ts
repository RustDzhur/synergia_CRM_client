import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toContractDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";

// POST /api/contracts/:id/complete — работы по действующему договору завершены (сдача-приёмка сделана вне системы или
// через отдельный документ в Files) — active → completed. Без своего события автоматизации: обычно к этому моменту всё
// уже закрыто через order_status/invoice_paid.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const found = await prisma.contract.findFirst({ where: { id: params.id, org: user.id } });
    if (!found) return notFound();
    if (found.status !== "active") return badRequest("Only an active contract can be completed");
    const c = await prisma.contract.update({ where: { id: found.id }, data: { status: "completed" } });
    await logAudit({ org: user.id, userId: user.userId, action: "contract.completed", entityType: "contract", entityId: c.id, summary: `Contract ${c.number} marked completed` });
    return NextResponse.json(toContractDTO(c));
}
