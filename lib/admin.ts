import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

// Администратор платформы (вы): адреса перечислены в переменной окружения ADMIN_EMAILS через запятую.
// Сначала зарегистрируйте этот аккаунт, потом добавляйте адрес в переменную — иначе адрес мог бы занять кто-то другой.
export const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isPlatformAdmin = (email?: string) => !!email && adminEmails().includes(email.toLowerCase());

export async function requirePlatformAdmin(req: Request) {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
        await connectDB();
        const user = await User.findById(sub);
        return user && isPlatformAdmin(user.email) ? { id: String(user._id), email: user.email as string } : null;
    } catch {
        return null;
    }
}
