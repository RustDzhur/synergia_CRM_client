import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { type Role, canAccess, moduleForPath } from "@/lib/access";
import { featureForApi, orgFeatures, orgPlan } from "@/lib/features";
import type { FeatureKey, PlanId } from "@/config/plans";
import { demoBlocked, isDemoEmail } from "@/lib/demo/rules";

// Кто делает запрос. id — идентификатор ФИРМЫ, в рамках которой работает пользователь: именно он записан в поле owner
// у всех данных CRM, поэтому маршруты, которые фильтруют по user.id, автоматически видят данные выбранной фирмы.
// userId — сам пользователь (для авторства, уведомлений, профиля).
export interface AuthContext {
    id: string;
    userId: string;
    role: Role;
    modules: string[];
    orgName: string;
    plan: PlanId;
    features: Record<FeatureKey, boolean>;
    /** Демо-кабинет (lib/demo): часть действий закрыта, ИИ ограничен. */
    demo: boolean;
}

const denied = new WeakSet<Request>(); // запрос отклонён из-за прав (а не из-за входа) — ответ 403
export const wasDenied = (req?: Request) => !!req && denied.has(req);

// Запрос отклонён из-за тарифа — отдельный признак, чтобы интерфейс показал не «нет прав», а предложение сменить тариф
const planDenied = new WeakSet<Request>();
export const wasPlanDenied = (req?: Request) => !!req && planDenied.has(req);

// Помета для маршрутов, которые сами проверяют тариф (например, /api/records): ответ будет 403 с кодом plan
export const denyPlan = (req: Request) => { planDenied.add(req); };

// Запрос отклонён, потому что в демо-кабинете это действие закрыто (ответ 403 с кодом demo)
const demoDenied = new WeakSet<Request>();
export const wasDemoDenied = (req?: Request) => !!req && demoDenied.has(req);

// Личная фирма пользователя (её id == id пользователя) создаётся при первом обращении — так данные, накопленные
// до появления фирм, остаются доступны.
async function ensurePersonalOrg(user: { id: string; firstname: string; lastname: string; company?: string | null }) {
    let org = await prisma.organization.findUnique({ where: { id: user.id } });
    if (!org) {
        try {
            org = await prisma.organization.create({ data: { id: user.id, name: user.company?.trim() || `${user.firstname} ${user.lastname}`.trim() || "My company", ownerUser: user.id } });
        } catch {
            org = await prisma.organization.findUnique({ where: { id: user.id } }); // параллельный запрос успел раньше
        }
    }
    let m = await prisma.membership.findFirst({ where: { org: user.id, user: user.id } });
    if (!m) {
        try { m = await prisma.membership.create({ data: { org: user.id, user: user.id, role: "owner" } }); } catch { m = await prisma.membership.findFirst({ where: { org: user.id, user: user.id } }); }
    }
    return { org, membership: m };
}

export async function requireUser(req: Request): Promise<AuthContext | null> {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return null;
    try {
        const { sub } = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
        const user = await prisma.user.findUnique({ where: { id: sub } });
        if (!user) return null;

        const wanted = req.headers.get("x-org-id") ?? "";
        let org: any = null;
        let membership: any = null;
        if (wanted && wanted !== user.id) {
            membership = await prisma.membership.findFirst({ where: { org: wanted, user: user.id } });
            if (membership) org = await prisma.organization.findUnique({ where: { id: wanted } });
        }
        // нет такой фирмы, нет доступа или её заблокировал администратор платформы — работаем в личной фирме
        if (!org || !membership || org.blocked) ({ org, membership } = await ensurePersonalOrg(user));
        if (!org || !membership) return null;

        const url = new URL(req.url);
        const demo = isDemoEmail(user.email);
        if (demo && demoBlocked(url.pathname, req.method)) { demoDenied.add(req); return null; }
        // личная фирма заблокирована: остаётся только список фирм (чтобы интерфейс показал причину и дал переключиться)
        if (org.blocked && !(req.method === "GET" && url.pathname === "/api/orgs")) { denied.add(req); return null; }
        // разговор с ИИ отправляется POST-запросом, но ничего не меняет (изменения ИИ выполняются отдельным запросом после подтверждения),
        // поэтому наблюдатель (viewer) им пользоваться может
        const method = url.pathname === "/api/ai/chat" ? "GET" : req.method;
        if (!canAccess(membership.role, membership.modules ?? [], moduleForPath(url.pathname, req.method), method)) {
            denied.add(req);
            return null;
        }
        // раздел, который открывает адрес, должен быть в тарифе фирмы (или выдан администратором платформы вручную)
        const features = orgFeatures(org);
        const needed = featureForApi(url.pathname);
        if (needed && !features[needed]) {
            planDenied.add(req);
            return null;
        }
        return { id: org.id, userId: user.id, role: membership.role, modules: membership.modules ?? [], orgName: org.name, plan: orgPlan(org), features, demo };
    } catch {
        return null;
    }
}
