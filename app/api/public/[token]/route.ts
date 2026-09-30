import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { failure } from "@/lib/api";
import { acceptQuote, shareData } from "@/lib/share";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Публичный доступ по ссылке: клиент фирмы смотрит статус заказа или принимает предложение.
// Вход в CRM не нужен — ссылка и есть пропуск, и она открывает ровно один документ.
//
// GET  /api/public/:token — данные страницы
// POST /api/public/:token — { accept: true, items?: number[] }: клиент принял предложение

export async function GET(_req: Request, { params }: { params: { token: string } }) {
    try {
        await connectDB();
        const data = await shareData(params.token);
        if (!data) return NextResponse.json({ message: "Not found" }, { status: 404 });
        return NextResponse.json(data);
    } catch (e) {
        return failure(e);
    }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
    try {
        await connectDB();
        const body = (await req.json().catch(() => ({}))) as { accept?: boolean; items?: unknown };
        if (!body.accept) return NextResponse.json({ message: "Bad request" }, { status: 400 });
        const picked = Array.isArray(body.items) ? body.items.map((n) => Number(n)).filter((n) => Number.isInteger(n)) : [];
        const result = await acceptQuote(params.token, picked);
        if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
        // Менеджер должен узнать о принятии сразу: клиент принимает предложение, пока кабинет закрыт
        const data = await shareData(params.token);
        if (data) {
            const { default: ShareLink } = await import("@/models/ShareLink");
            const link = await ShareLink.findOne({ token: params.token });
            if (link) {
                await notify(String(link.org), {
                    type: "message",
                    params: { name: data.customer || data.number, channel: "портал", text: `Клієнт прийняв пропозицію ${data.number}` },
                    link: "/crm/finance?tab=quotes",
                    key: `accept:${String(link._id)}`,
                }).catch(() => undefined);
            }
        }
        return NextResponse.json({ ok: true });
    } catch (e) {
        return failure(e);
    }
}
