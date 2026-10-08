import { NextResponse } from "next/server";
import { leadsForPartner } from "@/lib/partner/service";
import { withPartner } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// Заявки клиентов: только действующие и только выбранные клиентом поля
export const GET = withPartner(async (_req, { partner }) => NextResponse.json({ leads: await leadsForPartner(partner.id) }));
