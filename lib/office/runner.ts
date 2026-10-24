import { prisma } from "@/lib/prisma";
import { StepBudgetError, continuationTask, dailyLimit, log, runChat, takeQuota, type RunOpts } from "@/lib/ai/run";
import { ToolError, allowedTools, type AiCtx } from "@/lib/ai/tools";
import { OfficeError, IRIS_ID, type OfficeTask, type Robot, createTask, getRobot, getTask, getTaskScoped, listRobots, updateTask } from "./store";
import { bossPersona, robotPersona, toolsFor } from "./templates";
import { catalogById } from "./catalog";
import { findAds } from "@/lib/ads";
import { adsContext } from "@/lib/ads/robot";

// Исполнитель поручений Робот-офиса. Поручение роботу — это обычный разговор Айрис (runChat), в котором:
//   • инструменты ограничены навыками робота, а подсказка — его должностной инструкцией;
//   • изменения данных либо ждут подтверждения человека (робот «спрашивает»), либо выполняются сразу («делает сам»;
//     удаления и правки выставленных счетов — всегда с подтверждением, как у Айрис).
// Один робот делает по одному поручению за раз (следующие ждут в его очереди), разные роботы работают параллельно.

export interface OfficeCtx extends AiCtx { orgName?: string; /** вызывает администратор платформы (или внутренний запуск): роботы платформы доступны */ platformAdmin?: boolean }

// Подмена для тестов: настоящий разговор с моделью дорог и недетерминирован
export const deps = { runChat };
/** Роботы-наблюдатели (ловля ошибок, оптимизация сайта) инструментов не имеют и поручений не берут. */
export const watchOnly = (r: Pick<Robot, "skills">) => r.skills.length > 0 && r.skills.every((s) => s === "monitor");

const g = globalThis as { __officeChains?: Map<string, Promise<void>>; __officeActive?: Set<string> };
const chains = (g.__officeChains ??= new Map<string, Promise<void>>());
/** Поручения, которые выполняются прямо сейчас в этом процессе. «running» без записи здесь — прерванное перезапуском сервера. */
const active = (g.__officeActive ??= new Set<string>());

const fail = async (org: string, id: string, message: string) => updateTask(org, id, { status: "failed", error: message.slice(0, 400), finishedAt: new Date().toISOString() });

/** Текст «нужен доступ» на языке поручения: владельцу он читается без перевода. */
const adsAccessMessage = (locale?: string) => {
    const lang = (locale || "en").slice(0, 2);
    if (lang === "ru") return "НЕТ ДОСТУПА к Google Ads. Робот не может построить или оптимизировать кампанию, пока рекламный кабинет не подключён: Настройки → Маркетинг → Ad Performance → Connect Google Ads, затем выберите аккаунт и запустите поручение заново.";
    if (lang === "ua" || lang === "uk") return "НЕМАЄ ДОСТУПУ до Google Ads. Робот не може створити чи оптимізувати кампанію, доки рекламний кабінет не підключено: Налаштування → Маркетинг → Ad Performance → Connect Google Ads, потім виберіть акаунт і запустіть доручення знову.";
    if (lang === "de") return "ZUGANG FEHLT zu Google Ads. Der Roboter kann keine Kampagne aufbauen oder optimieren, solange kein Werbekonto verbunden ist: Einstellungen → Marketing → Ad Performance → Connect Google Ads, danach das Konto auswählen und die Aufgabe neu starten.";
    return "ACCESS MISSING for Google Ads. The robot cannot build or optimize a campaign while no ad account is connected: Settings → Marketing → Ad Performance → Connect Google Ads, then pick the account and start the task again.";
};

/** Ставит поручение в очередь робота и запускает в фоне. robot — id робота или "iris" (начальник распределяет сам). */
export async function startOfficeTask(ctx: OfficeCtx, input: { robot: string; text: string; source: OfficeTask["source"]; locale?: string }): Promise<OfficeTask> {
    const boss = input.robot === IRIS_ID;
    const robot = boss ? null : await getRobot(ctx.org, input.robot, { platform: ctx.platformAdmin });
    if (!boss && !robot) throw new OfficeError("Robot not found");
    if (robot && !robot.enabled) throw new OfficeError("This robot is switched off");
    if (robot && watchOnly(robot)) throw new OfficeError("This robot only watches the platform and takes no tasks");
    const task = await createTask(ctx.org, { robot: input.robot, robotName: boss ? "Ayris" : robot!.name, text: input.text, source: input.source, locale: input.locale ?? ctx.locale });
    const prev = chains.get(input.robot) ?? Promise.resolve();
    const run = prev.then(() => execute(ctx, task.id)).catch(() => undefined);
    chains.set(input.robot, run);
    void run.finally(() => { if (chains.get(input.robot) === run) chains.delete(input.robot); });
    return task;
}

async function execute(ctx: OfficeCtx, taskId: string): Promise<void> {
    const org = ctx.org;
    const task = await getTask(org, taskId);
    if (!task || task.status !== "queued") return; // отменено, пока ждало очереди
    const boss = task.robot === IRIS_ID;
    const robot = boss ? null : await getRobot(org, task.robot, { platform: true }); // доступ уже проверен при постановке поручения
    if (!boss && !robot) return void (await fail(org, taskId, "The robot was dismissed"));
    if (robot && !robot.enabled) return void (await fail(org, taskId, "This robot is switched off"));
    if (robot && watchOnly(robot)) return void (await fail(org, taskId, "This robot only watches the platform and takes no tasks"));

    // Рекламное поручение без подключённого кабинета выполнить нельзя. Раньше модель
    // просто отвечала «готово», и поручение закрывалось успехом — теперь это отказ
    // ДО работы, с просьбой дать доступ (и карточка открывает настройки подключения).
    const skills = robot?.skills ?? [];
    const adsTask = (skills.includes("ads") || boss) && /anz(eig|üg)|google ?ads|adwords|kampagn|реклам|конверс|conversion|оптимиз|optimier|clicks?|klicks?/i.test(task.text);
    if (adsTask) {
        const connection = (await findAds(org, "google"))[0];
        const cfg = (connection?.config ?? {}) as { accountId?: string };
        if (!connection || connection.status !== "connected" || !cfg.accountId) {
            return void (await fail(org, taskId, adsAccessMessage(task.locale)));
        }
        // Запись «connected» сама по себе ничего не значит: проверяем, что токен реально
        // обменивается и аккаунт отвечает. Иначе робот снова «поработал» бы вхолостую.
        try {
            await adsContext(org);
        } catch (e) {
            const detail = e instanceof Error ? e.message : "access check failed";
            return void (await fail(org, taskId, `${adsAccessMessage(task.locale)} (${detail})`));
        }
    }

    active.add(taskId);
    await updateTask(org, taskId, { status: "running", startedAt: new Date().toISOString() });
    try {
        if (!(await takeQuota(org, await dailyLimit(org)))) return void (await fail(org, taskId, "The daily AI limit of your plan is used up. It resets tomorrow."));
        const orgName = ctx.orgName ?? (await prisma.organization.findUnique({ where: { id: org }, select: { name: true } }))?.name ?? "";
        const base: RunOpts = { history: [{ role: "user", text: task.text }], locale: task.locale ?? ctx.locale ?? "en", page: "/crm/automation", orgName, noQueue: true };
        const opts: RunOpts = boss
            ? { ...base, allTools: true, persona: bossPersona((await listRobots(org)).filter((r) => !watchOnly(r)).map((r) => ({ id: r.id, name: r.name, title: robotTitle(r), skills: r.skills, enabled: r.enabled }))) }
            : { ...base, auto: robot!.autonomy === "auto", onlyTools: toolsFor(robot!.skills), persona: robotPersona({ name: robot!.name, title: robotTitle(robot!), duties: await robotDuties(robot!) }, orgName) };

        // Большое поручение может не уложиться в шаги одного круга: продолжаем с описанием сделанного (до двух раз), а не сдаёмся
        let current = task.text, res = null as Awaited<ReturnType<typeof runChat>> | null;
        const pending: OfficeTask["pending"] = [], executed: OfficeTask["executed"] = [], steps: string[] = [];
        for (let attempt = 0; attempt < 3 && !res; attempt++) {
            try {
                res = await deps.runChat(ctx, { ...opts, history: [{ role: "user", text: current }] });
            } catch (e) {
                if (!(e instanceof StepBudgetError) || attempt === 2) throw e;
                pending.push(...e.actions); executed.push(...e.executed); steps.push(...e.steps);
                current = continuationTask(task.text, e.progress);
            }
        }
        const all = { pending: [...pending, ...res!.actions], executed: [...executed, ...(res!.executed ?? [])], steps: Array.from(new Set([...steps, ...res!.steps])) };
        const adsActions = all.executed.filter((action) => String(action.tool || "").startsWith("ads_"));
        const accessMissing = /(ZUGANG FEHLT|ACCESS MISSING|НЕТ ДОСТУПА)/i.test(res!.reply || "");
        if (adsTask && adsActions.length === 0 && all.pending.length === 0) {
            // Поручение про рекламу, но ни одного шага в Google Ads: это не «готово».
            return void (await fail(org, taskId,
                `${adsAccessMessage(task.locale)} (Antwort: ${String(res!.reply || "").slice(0, 200)})`));
        }
        if (accessMissing && all.executed.length === 0) {
            return void (await fail(org, taskId, `Zugang fehlt — der Roboter hat nichts ausgeführt: ${String(res!.reply || "").slice(0, 320)}`));
        }
        await updateTask(org, taskId, { ...all, reply: res!.reply, status: all.pending.length ? "waiting" : "done", finishedAt: all.pending.length ? undefined : new Date().toISOString() });
    } catch (e) {
        await fail(org, taskId, e instanceof Error && e.message ? e.message : "The task failed");
    } finally {
        active.delete(taskId);
    }
}

export const robotTitle = (r: Robot) => r.title;
export const robotDuties = async (r: Robot) => r.instructions || (await catalogById(r.template))?.duties || "Help the company owner within your skills.";

/** «Работает» без живого исполнителя — поручение прервал перезапуск сервера: показываем как сорвавшееся, а не как вечную работу. */
export async function sweepInterrupted(org: string, tasks: OfficeTask[]): Promise<OfficeTask[]> {
    const out: OfficeTask[] = [];
    for (const t of tasks) {
        if ((t.status === "running" || t.status === "queued") && !active.has(t.id) && !chains.has(t.robot) && Date.now() - Date.parse(t.startedAt ?? t.createdAt) > 60_000) {
            out.push((await updateTask(org, t.id, { status: "failed", error: "Interrupted by a server restart — start it again", finishedAt: new Date().toISOString() })) ?? t);
        } else out.push(t);
    }
    return out;
}

// ── решение человека по поручению ──────────────────────────────────────────────

/** Подтверждает действия, которые робот предложил (все или выбранные): выполняются от имени человека с его правами. */
export async function confirmTask(ctx: AiCtx, taskId: string, actionIds?: string[]): Promise<OfficeTask> {
    const task = await getTask(ctx.org, taskId);
    if (!task) throw new OfficeError("Task not found");
    if (task.status !== "waiting") throw new OfficeError("Nothing is waiting for confirmation");
    const chosen = task.pending.filter((a) => !actionIds || actionIds.includes(a.id));
    const rest = task.pending.filter((a) => !chosen.includes(a));
    const executed = [...task.executed];
    for (const a of chosen) {
        const tool = allowedTools(ctx).find((t) => t.write && t.def.name === a.tool);
        if (!tool) { executed.push({ ...a, state: "failed", message: "This action is not available" }); continue; }
        try {
            const args = tool.check ? tool.check(a.args) : a.args;
            const out = (await tool.run(ctx, args)) as { params?: Record<string, string>; link?: string };
            await log(ctx, "executed", tool.def.name, args);
            executed.push({ ...a, state: "done", params: out.params ?? {}, link: out.link ?? "" });
        } catch (e) {
            await log(ctx, "failed", tool.def.name, a.args, e instanceof Error ? e.message : "");
            executed.push({ ...a, state: "failed", message: e instanceof ToolError ? e.message : "The action failed" });
        }
    }
    return (await updateTask(ctx.org, taskId, { executed, pending: rest, status: rest.length ? "waiting" : "done", finishedAt: rest.length ? undefined : new Date().toISOString() }))!;
}

/** Отказ от предложенных действий: ничего не выполняется, поручение закрывается. */
export async function rejectTask(org: string, taskId: string): Promise<OfficeTask> {
    const task = await getTask(org, taskId);
    if (!task) throw new OfficeError("Task not found");
    if (task.status !== "waiting") throw new OfficeError("Nothing is waiting for confirmation");
    return (await updateTask(org, taskId, { pending: [], status: "cancelled", finishedAt: new Date().toISOString() }))!;
}

/** Отменить можно то, что ещё не началось. */
export async function cancelTask(org: string, taskId: string): Promise<OfficeTask> {
    const task = await getTask(org, taskId);
    if (!task) throw new OfficeError("Task not found");
    if (task.status !== "queued") throw new OfficeError("Only a task that has not started can be cancelled");
    return (await updateTask(org, taskId, { status: "cancelled", finishedAt: new Date().toISOString() }))!;
}

/** Перетащили поручение на другого робота: ещё не начатое переезжает, остальное повторяется у нового робота. */
export async function reassignTask(ctx: OfficeCtx, taskId: string, robotId: string): Promise<OfficeTask> {
    const task = await getTaskScoped(ctx.org, taskId, { platform: ctx.platformAdmin });
    if (!task) throw new OfficeError("Task not found");
    if (task.robot === robotId) return task;
    if (task.status === "running") throw new OfficeError("The task is being worked on right now");
    if (task.status === "queued") await updateTask(ctx.org, taskId, { status: "cancelled", finishedAt: new Date().toISOString() });
    if (task.status === "waiting") await rejectTask(ctx.org, taskId);
    return startOfficeTask(ctx, { robot: robotId, text: task.text, source: "drop", locale: task.locale });
}
