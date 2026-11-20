import { prisma } from "@/lib/prisma";
import { createTask, listTasks, updateTask } from "@/lib/office/store";

// Ада — робот-автор блога из Робот-офиса (шаблон p_blog, зона «Платформа», видна только администратору платформы).
// Серверный cron блога (/api/cron/blog) — это её «руки»: выключатель Ады в Робот-офисе выключает и cron,
// а каждый его запуск виден в Робот-офисе как поручение Аде. Если Ады нет (уволена) — cron тоже не работает.

export interface BlogRobotRef { org: string; id: string; name: string; enabled: boolean }

/** Робот Ада платформы: запись Robot с шаблоном p_blog (одна, у фирмы администратора платформы). Нет записи — null. */
export async function findBlogRobot(): Promise<BlogRobotRef | null> {
    const row = await prisma.robot.findFirst({ where: { data: { path: ["template"], equals: "p_blog" } }, orderBy: { createdAt: "asc" } }).catch(() => null);
    if (!row) return null;
    const name = String((row.data as { name?: unknown } | null)?.name ?? "") || "Ada";
    return { org: row.org, id: row.rid, name, enabled: row.enabled };
}

const FAILED_TASK_EVERY_MS = 6 * 3600 * 1000;

/**
 * Записать запуск блога в Робот-офис как поручение Аде. Успех — всегда; сбой — не чаще раза в 6 часов
 * (cron стучится каждые 10 минут, и журнал не должен заполняться одним и тем же). Ничего не бросает.
 */
export async function recordBlogRun(robot: BlogRobotRef, outcome: { ok: true; slug: string } | { ok: false; error: string }): Promise<void> {
    try {
        if (!outcome.ok) {
            const recent = (await listTasks(robot.org, 30)).find((t) => t.robot === robot.id && t.status === "failed" && t.source === "routine");
            if (recent && Date.now() - Date.parse(recent.finishedAt ?? recent.createdAt) < FAILED_TASK_EVERY_MS) return;
        }
        const task = await createTask(robot.org, {
            robot: robot.id, robotName: robot.name, source: "routine",
            text: outcome.ok ? `Blog article published: ${outcome.slug}` : "Write and publish a blog article",
        });
        await updateTask(robot.org, task.id, outcome.ok
            ? { status: "done", reply: `Published: ${outcome.slug}`, startedAt: task.createdAt, finishedAt: new Date().toISOString() }
            : { status: "failed", error: outcome.error.slice(0, 400), startedAt: task.createdAt, finishedAt: new Date().toISOString() });
    } catch { /* журнал офиса — вторичен, на работу блога не влияет */ }
}
