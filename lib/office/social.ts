import { prisma } from "@/lib/prisma";
import { publishPost } from "@/lib/social/publish";
import { markPostFailed, markPostPublished, nextQueuedPost } from "@/lib/social/queue";
import { createRobot, createTask, updateTask } from "./store";

// Робот платформы «Social Poster»: раз в 8 часов берёт следующий немецкий пост из очереди (social_posts),
// публикует его на странице Facebook и дублирует в Instagram, а в журнал робота пишет, что именно вышло.
// Публикация детерминированная (без разговора с моделью): пост в соцсети — это доставка, а не рассуждение,
// и он не должен зависеть от того, ответит ли модель и не «придумает» ли она текст. Модель тут не нужна:
// тексты лежат в очереди, картинки — в public/brand.

export const SOCIAL_TEMPLATE = "p_social";
const MARK_KEY = "office:meta";
const MARK_RID = "social";
const ROUTINE_TEXT = "Veröffentliche den nächsten Beitrag aus der Social-Queue auf Facebook und Instagram und protokolliere die Links.";

const log = (message: string) => console.error(`[social] ${message}`);

/** Один раз на фирму администратора платформы: робот с рутиной каждые 8 часов. Уволить можно — повторно не нанимается. */
export async function ensureSocialRobot(org: string): Promise<void> {
    const rows = await prisma.robot.findMany({ where: { org } });
    if (rows.some((r) => (r.data as { template?: string } | null)?.template === SOCIAL_TEMPLATE)) return;
    const mark = await prisma.sectionRecord.findFirst({ where: { org, key: MARK_KEY, rid: MARK_RID } });
    if (mark) return;
    try {
        await prisma.sectionRecord.create({ data: { org, key: MARK_KEY, rid: MARK_RID, values: { at: new Date().toISOString() } as never } });
    } catch {
        return;
    }
    try {
        await createRobot(
            org,
            {
                template: SOCIAL_TEMPLATE,
                title: "Social Media Manager",
                routines: [{ text: ROUTINE_TEXT, kind: "interval", time: "", everyMinutes: 8 * 60 }],
            },
            { platform: true }
        );
    } catch (e) {
        log(`robot was not created: ${e instanceof Error ? e.message : String(e)}`);
    }
}

export interface SocialRoutineInput {
    org: string;
    robotId: string;
    robotName: string;
    locale?: string;
}

/** Обход очереди: пишет поручение-запись в журнал робота, публикует, обновляет очередь. Возвращает true, если попытка была сделана. */
export async function runSocialRoutine(input: SocialRoutineInput): Promise<boolean> {
    const post = await nextQueuedPost();
    const task = await createTask(input.org, {
        robot: input.robotId,
        robotName: input.robotName || "Social Poster",
        text: post.text,
        source: "routine",
        locale: input.locale,
    });
    const startedAt = new Date().toISOString();
    await updateTask(input.org, task.id, { status: "running", startedAt });
    try {
        const result = await publishPost({ text: post.text, imagePath: post.image });
        await markPostPublished(post.id, result);
        const reply = [
            `Auf Facebook veröffentlicht: ${result.fbUrl}`,
            `In Instagram: ${result.igUrl || "—"}`,
            ...(result.igError ? [`Instagram hat nicht angenommen: ${result.igError}`] : []),
            `Thema: ${post.key}`,
        ].join("\n");
        await updateTask(input.org, task.id, {
            status: "done",
            finishedAt: new Date().toISOString(),
            reply,
            steps: [
                `Social-Queue: Thema ${post.key}`,
                `Facebook: ${result.fbUrl}`,
                `Instagram: ${result.igUrl || result.igError || "—"}`,
            ],
            executed: [
                {
                    id: `social_${post.id}`,
                    tool: "social_publish",
                    args: { key: post.key, image: post.image },
                    target: result.fbUrl,
                    state: "done",
                    link: result.fbUrl,
                    message: result.igUrl ? `Facebook + Instagram: ${result.igUrl}` : "Facebook (Instagram nicht angenommen)",
                },
            ],
        });
        return true;
    } catch (e) {
        const message = e instanceof Error && e.message ? e.message : "Social publishing failed";
        await markPostFailed(post.id, message).catch(() => undefined);
        await updateTask(input.org, task.id, {
            status: "failed",
            error: message.slice(0, 400),
            finishedAt: new Date().toISOString(),
            steps: [`Social-Queue: Thema ${post.key}`, `Fehler: ${message}`],
        });
        return true;
    }
}
