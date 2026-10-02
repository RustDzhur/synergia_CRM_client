import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { toContractDTO } from "@/lib/finance/dto";
import { prisma } from "@/lib/prisma";

// POST /api/contracts/:id/cancel — draft или active → cancelled (сорвалась сделка, клиент отказался).
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const found = await prisma.contract.findFirst({ where: { id: params.id, org: user.id } });
    if (!found) return notFound();
    if (found.status !== "draft" && found.status !== "active") return badRequest("This contract cannot be cancelled");
    const c = await prisma.contract.update({ where: { id: found.id }, data: { status: "cancelled" } });
    await logAudit({ org: user.id, userId: user.userId, action: "contract.cancelled", entityType: "contract", entityId: c.id, summary: `Contract ${c.number} cancelled` });
    return NextResponse.json(toContractDTO(c));
}
