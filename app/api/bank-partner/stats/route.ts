import { NextResponse } from "next/server";
import { stats } from "@/lib/partner/service";
import { withPartner } from "@/lib/partner/http";

export const dynamic = "force-dynamic";

// Агрегаты банка: воронка, подключённые счета, объём (только по согласившимся фирмам и не менее порога). Данных фирм нет.
export const GET = withPartner(async (_req, { partner }) => NextResponse.json(await stats(partner.id)));
