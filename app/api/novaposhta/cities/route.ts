import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { failure, unauthorized } from "@/lib/api";
import { cities, warehouses } from "@/lib/finance/delivery";
import { requireMarket } from "@/lib/finance/marketGuard";

export const dynamic = "force-dynamic";

// GET /api/novaposhta/cities?q=Київ — поиск городов по справочнику Нової Пошти
// GET /api/novaposhta/cities?city=<ref>&q= — отделения выбранного города
// Оба справочника отдаём одним маршрутом: интерфейсу они нужны вместе, в одном окне выбора.
export async function GET(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const url = new URL(req.url);
    const cityRef = url.searchParams.get("city") ?? "";
    const query = (url.searchParams.get("q") ?? "").trim();
    try {
        await connectDB();
        await requireMarket(user.id, "UA");
        if (cityRef) return NextResponse.json({ warehouses: await warehouses(user.id, cityRef, query) });
        if (query.length < 2) return NextResponse.json({ cities: [] });
        return NextResponse.json({ cities: await cities(user.id, query) });
    } catch (e) {
        return failure(e);
    }
}
