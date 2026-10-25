import type { AuthContext } from "@/lib/auth";
import { requireUser } from "@/lib/auth";
import { isPlatformAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ensureSocialQueue } from "./queue";

// Доступ к публикации в соцсети платформы: только владелец платформы (администратор) с ролью owner/admin
// в своей фирме. Ссылка на страницу и токен одни на платформу, поэтому «владелец» здесь — владелец платформы,
// а не владелец любой клиентской фирмы.
export async function authorizeSocialOwner(req: Request): Promise<AuthContext | null> {
    const user = await requireUser(req);
    if (!user) return null;
    if (user.role !== "owner" && user.role !== "admin") return null;
    const row = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true, email: true, platformAdmin: true } });
    return (await isPlatformAdminUser(row)) ? user : null;
}

/** Состояние очереди для владельца: что выйдет следующим и чем закончились последние публикации. */
export async function socialQueueStatus() {
    await ensureSocialQueue();
    const [queued, published, failed, last] = await Promise.all([
        prisma.socialPost.count({ where: { status: "queued" } }),
        prisma.socialPost.count({ where: { status: "published" } }),
        prisma.socialPost.count({ where: { status: "failed" } }),
        prisma.socialPost.findMany({ orderBy: { updatedAt: "desc" }, take: 10 }),
    ]);
    return {
        counts: { queued, published, failed, total: queued + published + failed },
        last: last.map((p) => ({
            key: p.key,
            status: p.status,
            attempts: p.attempts,
            publishedAt: p.publishedAt,
            fbUrl: p.fbUrl,
            igUrl: p.igUrl,
            error: p.error,
            text: p.text.slice(0, 200),
        })),
    };
}
