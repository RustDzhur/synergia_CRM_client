import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized, validId } from "@/lib/api";
import { unreadFor, visibleTo } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/notifications/read — { ids: string[] } или { all: true }: отметить прочитанным (только для себя).
// В ответе — сколько непрочитанных осталось. Число считает сервер, потому что в списке приходят лишь последние
// 50 уведомлений: непрочитанные могут быть и старше, и на клиенте их не сосчитать.
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => null)) as { ids?: unknown; all?: boolean } | null;
    const raw = b && Array.isArray(b.ids) ? b.ids : [];
    const ids = raw.filter((i): i is string => typeof i === "string" && validId(i));
    const all = b?.all === true;
    if (!all && !ids.length) return badRequest("No notifications selected");
    // Отмечаем ровно то, что этот участник видит (тот же фильтр, что и в списке): чужие личные уведомления не трогаем.
    const base = visibleTo(user.id, user.userId);
    const filter = all ? base : { ...base, id: { in: ids } };
    // $addToSet-семантика: push только тем, у кого отметки ещё нет, иначе пользователь попал бы в массив дважды
    await prisma.notification.updateMany({ where: { ...filter, NOT: { readBy: { has: user.userId } } } as any, data: { readBy: { push: user.userId } } });
    return NextResponse.json({ ok: true, unread: await prisma.notification.count({ where: unreadFor(user.id, user.userId) as any }) });
}
