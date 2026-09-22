import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, notFound, unauthorized, validId } from "@/lib/api";
import { emit } from "@/lib/automation/emit";
import { logAudit } from "@/lib/audit";
import Contract from "@/models/Contract";
import { toContractDTO } from "@/lib/finance/dto";

// POST /api/contracts/:id/sign — договор подписан клиентом: draft → active + событие contract_signed. С этого события
// правилом автоматизации можно поднять задачу "закупить материалы", создать заказ, сдвинуть сделку и т.п.
export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    await connectDB();
    const c = await Contract.findOne({ _id: params.id, org: user.id });
    if (!c) return notFound();
    if (c.status !== "draft") return badRequest("Only a draft contract can be signed");
    c.status = "active";
    c.signedAt = new Date();
    await c.save();
    await emit(user.id, { type: "contract_signed", data: { id: String(c._id), number: c.number, customerName: c.customerName, value: String(c.value), currency: c.currency, dealId: c.deal ? String(c.deal) : "" } });
    await logAudit({ org: user.id, userId: user.userId, action: "contract.signed", entityType: "contract", entityId: String(c._id), summary: `Contract ${c.number} signed by ${c.customerName} — ${c.value} ${c.currency}`, meta: { value: c.value, currency: c.currency } });
    return NextResponse.json(toContractDTO(c));
}
