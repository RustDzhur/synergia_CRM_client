import { NextResponse } from "next/server";
import { Types, isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/api";
import { unreadFor, visibleTo } from "@/lib/notify";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

// POST /api/notifications/read — { ids: string[] } или { all: true }: отметить прочитанным (только для себя).
// В ответе — сколько непрочитанных осталось. Число считает сервер, потому что в списке приходят лишь последние
// 50 уведомлений: непрочитанные могут быть и старше, и на клиенте их не сосчитать (счётчик из-за этого «залипал»).
export async function POST(req: Request) {
    const user = await requireUser(req);
    if (!user) return unauthorized(req);
    const b = (await req.json().catch(() => null)) as { ids?: unknown; all?: boolean } | null;
    const raw = b && Array.isArray(b.ids) ? b.ids : [];
    const ids = raw.filter((i): i is string => typeof i === "string" && isValidObjectId(i));
    // Тело без all и без единого корректного id — ошибка. Раньше такой запрос отвечал «ок», ничего не отметив,
    // и клиент считал отметку выполненной.
    const all = b?.all === true;
    if (!all && !ids.length) return badRequest("No notifications selected");
    await connectDB();
    const me = new Types.ObjectId(user.userId);
    // Отмечаем ровно то, что этот участник видит (тот же фильтр, что и в списке): чужие личные уведомления не трогаем.
    const filter = all
        ? visibleTo(user.id, user.userId)
        : { ...visibleTo(user.id, user.userId), _id: { $in: ids.map((id) => new Types.ObjectId(id)) } };
    await Notification.updateMany(filter, { $addToSet: { readBy: me } });
    return NextResponse.json({ ok: true, unread: await Notification.countDocuments(unreadFor(user.id, user.userId)) });
}
