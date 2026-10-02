import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

// Администратор платформы — тот, кто видит кабинет администратора: фирмы, пользователей, тарифы и блог.
//
// Признаков три, и хватает любого:
// 1) адрес перечислен в переменной окружения ADMIN_EMAILS через запятую (основной способ);
// 2) у записи пользователя стоит platformAdmin — так администратор выдаёт доступ из своего кабинета,
//    не перезапуская приложение ради переменной окружения;
// 3) ни одного администратора ещё нет — тогда им считается самый первый зарегистрированный аккаунт.
//    Это нужно ровно один раз: на новой установке иначе некого назначить, а переменную окружения
//    не всегда удобно задавать. Как только администратор появился любым из первых двух способов,
//    правило перестаёт действовать.
export const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isPlatformAdmin = (email?: string) => !!email && adminEmails().includes(email.toLowerCase());

// user приходит и из Prisma (id), и — на время переезда — из не переведённых ещё Mongoose-модулей (_id).
type AdminUser = { email?: string; platformAdmin?: boolean; _id?: unknown; id?: unknown };

// Проверка с учётом записи пользователя и первого аккаунта. Отдельная функция, потому что
// синхронная isPlatformAdmin используется в местах, где база недоступна.
export async function isPlatformAdminUser(user: AdminUser | null | undefined): Promise<boolean> {
    if (!user) return false;
    if (user.platformAdmin) return true;
    if (isPlatformAdmin(user.email)) return true;
    if (adminEmails().length) return false;

    // Ни переменной, ни флага: администратора ещё не назначали. Считаем им самый ранний аккаунт,
    // но только если среди пользователей вообще нет ни одного с флагом — иначе правило не нужно.
    const flagged = await prisma.user.findFirst({ where: { platformAdmin: true }, select: { id: true } });
    if (flagged) return false;
    const first = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    return !!first && first.id === String(user.id ?? user._id);
}

export async function requirePlatformAdmin(req: Request) {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
        const user = await prisma.user.findUnique({ where: { id: sub } });
        if (!user) return null;
        // учитываем и флаг в записи, и первый аккаунт — иначе на установке без ADMIN_EMAILS
        // кабинет администратора был бы недоступен вообще никому
        return (await isPlatformAdminUser(user)) ? { id: user.id, email: user.email } : null;
    } catch {
        return null;
    }
}
