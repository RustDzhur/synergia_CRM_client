import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";

// «Ответственный» в сделках и задачах вводится словами (имя в текстовом поле), а уведомления и видимость нужны по
// конкретному участнику фирмы. Здесь слово сопоставляется с участником: по полному имени, по e-mail или по имени,
// если оно одно на всю фирму. Не нашли или неоднозначно — null: тогда остаётся только текст, как было раньше.
export async function resolveResponsible(org: string, text: unknown): Promise<string | null> {
    const q = typeof text === "string" ? text.trim().toLowerCase() : "";
    if (!q) return null;
    const members = await prisma.membership.findMany({ where: { org }, select: { user: true } });
    if (!members.length) return null;
    const users = await prisma.user.findMany({ where: { id: { in: members.map((m) => String(m.user)) } }, select: { id: true, firstname: true, lastname: true, email: true } });
    const full = (u: { firstname: string; lastname: string }) => `${u.firstname} ${u.lastname}`.trim().toLowerCase();
    const exact = users.filter((u) => full(u) === q || u.email.toLowerCase() === q);
    if (exact.length === 1) return exact[0].id;
    const byFirst = users.filter((u) => u.firstname.trim().toLowerCase() === q);
    return byFirst.length === 1 ? byFirst[0].id : null;
}

// Какие сделки видит участник. Флаг «доступно всем» (Deal.availableToAll) раньше только сохранялся и нигде не
// применялся. Теперь закрытую сделку видят владелец и администратор фирмы и назначенный ответственный.
export function dealScope(user: Pick<AuthContext, "role" | "userId">): Record<string, unknown> {
    if (user.role === "owner" || user.role === "admin") return {};
    return { OR: [{ availableToAll: true }, { responsibleUser: user.userId }] };
}
