import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { canAccess, moduleForPath, type Role } from "@/lib/access";
import User from "@/models/User";
import Organization from "@/models/Organization";
import Membership from "@/models/Membership";

// Кто делает запрос. id — идентификатор ФИРМЫ, в рамках которой работает пользователь: именно он записан в поле owner
// у всех данных CRM, поэтому маршруты, которые фильтруют по user.id, автоматически видят данные выбранной фирмы.
// userId — сам пользователь (для авторства, уведомлений, профиля).
export interface AuthContext { id: string; userId: string; role: Role; modules: string[]; orgName: string }

const denied = new WeakSet<Request>(); // запрос отклонён из-за прав (а не из-за входа) — ответ 403
export const wasDenied = (req?: Request) => !!req && denied.has(req);

// Личная фирма пользователя (её _id == _id пользователя) создаётся при первом обращении — так данные, накопленные
// до появления фирм, остаются доступны.
async function ensurePersonalOrg(user: { _id: any; firstname: string; lastname: string; company?: string }) {
    let org = await Organization.findById(user._id);
    if (!org) {
        try {
            org = await Organization.create({ _id: user._id, name: user.company?.trim() || `${user.firstname} ${user.lastname}`.trim() || "My company", ownerUser: user._id });
        } catch {
            org = await Organization.findById(user._id); // параллельный запрос успел раньше
        }
    }
    let m = await Membership.findOne({ org: user._id, user: user._id });
    if (!m) {
        try { m = await Membership.create({ org: user._id, user: user._id, role: "owner" }); } catch { m = await Membership.findOne({ org: user._id, user: user._id }); }
    }
    return { org, membership: m };
}

export async function requireUser(req: Request): Promise<AuthContext | null> {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
        await connectDB();
        const user = await User.findById(sub);
        if (!user) return null;

        const wanted = req.headers.get("x-org-id") ?? "";
        let org: any = null;
        let membership: any = null;
        if (wanted && isValidObjectId(wanted) && wanted !== String(user._id)) {
            membership = await Membership.findOne({ org: wanted, user: user._id });
            if (membership) org = await Organization.findById(wanted);
        }
        // нет такой фирмы, нет доступа или её заблокировал администратор платформы — работаем в личной фирме
        if (!org || !membership || org.blocked) ({ org, membership } = await ensurePersonalOrg(user));
        if (!org || !membership) return null;

        const url = new URL(req.url);
        // личная фирма заблокирована: остаётся только список фирм (чтобы интерфейс показал причину и дал переключиться)
        if (org.blocked && !(req.method === "GET" && url.pathname === "/api/orgs")) { denied.add(req); return null; }
        if (!canAccess(membership.role, membership.modules ?? [], moduleForPath(url.pathname, req.method), req.method)) {
            denied.add(req);
            return null;
        }
        return { id: String(org._id), userId: String(user._id), role: membership.role, modules: membership.modules ?? [], orgName: org.name };
    } catch {
        return null;
    }
}
