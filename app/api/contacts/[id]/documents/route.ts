import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { notFound, unauthorized, validId } from "@/lib/api";
import { documentsOf } from "@/lib/sync/overview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/contacts/[id]/documents — документы клиента одной лентой: предложения, счета, заказы, договоры.
// Владелец: «карточка клиента должна вестись по CRM — что он заказал и так далее, пока клиент не
// свершится полностью». В карточке контакта видно всё, что ему выставили, — как в карточке сделки.
export async function GET(req: Request, { params }: { params: { id: string } }) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    if (!validId(params.id)) return notFound();
    const contact = await prisma.contact.findFirst({ where: { id: params.id, owner: user.id }, select: { id: true } });
    if (!contact) return notFound();

    return NextResponse.json(await documentsOf(user.id, { contact: contact.id }));
}
