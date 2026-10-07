import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { canAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/calendar/derived?from=YYYY-MM-DD&to=YYYY-MM-DD — сроки из других разделов, которые календарь показывает рядом
// с событиями: оплата неоплаченных счетов, окончание действующих договоров, срок открытых сделок. Это не копии, а
// записи из самих разделов: перенесли срок в счёте — календарь показывает новое число. Раздел отдаётся только тем,
// у кого есть доступ к нему (счета и договоры — финансы, сделки — CRM).
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!DAY.test(from) || !DAY.test(to)) return badRequest("from and to must be YYYY-MM-DD");

    const canFinance = canAccess(user.role, user.modules, "inventory", "GET") && user.features.inventory;
    const canCrm = canAccess(user.role, user.modules, "crm", "GET") && user.features.crm;
    const [invoices, contracts, deals] = await Promise.all([
        canFinance ? prisma.invoice.findMany({ where: { org: user.id, kind: "invoice", status: { in: ["sent", "overdue"] }, dueDate: { gte: from, lte: to } }, select: { id: true, number: true, customerName: true, dueDate: true, status: true }, take: 300 }) : [],
        canFinance ? prisma.contract.findMany({ where: { org: user.id, status: "active", endDate: { gte: from, lte: to } }, select: { id: true, number: true, customerName: true, endDate: true }, take: 300 }) : [],
        canCrm ? prisma.deal.findMany({ where: { owner: user.id, wonAt: null, endDate: { gte: from, lte: to } }, select: { id: true, clientName: true, endDate: true } , take: 300 }) : [],
    ]);

    return NextResponse.json([
        ...invoices.map((i) => ({ id: `invoice:${i.id}`, kind: "invoice", date: i.dueDate, title: `${i.number} ${i.customerName}`.trim(), overdue: i.status === "overdue", href: `/crm/finance?tab=invoices&open=${i.id}` })),
        ...contracts.map((c) => ({ id: `contract:${c.id}`, kind: "contract", date: c.endDate, title: `${c.number} ${c.customerName}`.trim(), overdue: false, href: `/crm/finance?tab=contracts&open=${c.id}` })),
        ...deals.map((d) => ({ id: `deal:${d.id}`, kind: "deal", date: d.endDate.slice(0, 10), title: d.clientName, overdue: false, href: "/crm/crm" })),
    ]);
}
