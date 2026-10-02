import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { unauthorized, validId } from "@/lib/api";
import { pickStrings, mkActivity } from "@/lib/activities";
import { DEAL_TEXT_FIELDS } from "@/lib/crmFields";
import { emitDeal } from "@/lib/automation/emit";
import { ownedContact, ownedCompany } from "@/lib/deals";
import { prisma } from "@/lib/prisma";
import { toDTO, toDTOs } from "@/lib/serialize";

// GET /api/deals — все сделки текущего пользователя
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const deals = await prisma.deal.findMany({ where: { owner: user.id }, orderBy: { order: "asc" } });
    return NextResponse.json(toDTOs(deals));
}

// POST /api/deals — добавить сделку в колонку (кнопка "Add" в макете)
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);

    const body = await req.json();
    const clientName = typeof body.clientName === "string" ? body.clientName.trim().slice(0, 200) : "";
    if (!body.stage || !clientName) {
        return NextResponse.json({ message: "stage and clientName are required" }, { status: 400 });
    }
    if (!validId(body.stage)) return NextResponse.json({ message: "Invalid stage" }, { status: 400 });

    const stage = await prisma.stage.findFirst({ where: { id: body.stage, owner: user.id } });
    if (!stage) return NextResponse.json({ message: "Stage not found" }, { status: 404 });

    const [contact, company] = await Promise.all([ownedContact(body.contact, user.id), ownedCompany(body.company, user.id)]);
    const count = await prisma.deal.count({ where: { owner: user.id, stage: stage.id } });
    const deal = await prisma.deal.create({
        data: {
            ...pickStrings(body, DEAL_TEXT_FIELDS),
            owner: user.id,
            stage: stage.id,
            clientName,
            contact: contact ?? undefined,
            company: company ?? undefined,
            order: count,
            activities: [mkActivity("created", clientName)],
        },
    });

    await emitDeal(user.id, toDTO(deal), "deal_created");
    return NextResponse.json(toDTO(deal), { status: 201 });
}
