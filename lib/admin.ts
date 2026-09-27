import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

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

// Проверка с учётом записи пользователя и первого аккаунта. Отдельная функция, потому что
// синхронная isPlatformAdmin используется в местах, где база недоступна.
export async function isPlatformAdminUser(user: { email?: string; platformAdmin?: boolean; _id?: unknown } | null | undefined): Promise<boolean> {
    if (!user) return false;
    if (user.platformAdmin) return true;
    if (isPlatformAdmin(user.email)) return true;
    if (adminEmails().length) return false;

    // Ни переменной, ни флага: администратора ещё не назначали. Считаем им самый ранний аккаунт,
    // но только если среди пользователей вообще нет ни одного с флагом — иначе правило не нужно.
    const flagged = await User.exists({ platformAdmin: true });
    if (flagged) return false;
    const first = await User.findOne().sort({ createdAt: 1 }).select("_id");
    return !!first && String(first._id) === String(user._id);
}

export async function requirePlatformAdmin(req: Request) {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
        await connectDB();
        const user = await User.findById(sub);
        if (!user) return null;
        // учитываем и флаг в записи, и первый аккаунт — иначе на установке без ADMIN_EMAILS
        // кабинет администратора был бы недоступен вообще никому
        return (await isPlatformAdminUser(user)) ? { id: String(user._id), email: user.email as string } : null;
    } catch {
        return null;
    }
}
