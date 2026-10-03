import { randomUUID } from "node:crypto";
import { doneReply, langOf } from "./fastReply";
import { type AiCtx } from "./tools";
import { type ChatResult, type RunOpts, StepBudgetError, continuationTask, runChat } from "./run";

// Очередь задач Айрис: длинное сообщение с несколькими поручениями («создай расход…, подтверди заказы…, пришли отчёт…»)
// модель раскладывает инструментом queue_tasks, а здесь задачи выполняются по одной в фоне; результат каждой человек
// получает сразу, не дожидаясь остальных (страница опрашивает /api/ai/jobs/<id>, Telegram-бот отвечает по мере готовности).
// Хранится в памяти процесса: контейнер один, а потерять очередь при перезапуске — не страшно (человек увидит, что готово).

export interface JobResult extends ChatResult { task: string; index: number; error?: boolean }
export interface Job { id: string; org: string; userId: string; total: number; results: JobResult[]; status: "running" | "done"; summary: string; createdAt: number }

// на globalThis: маршрут чата и маршрут опроса могут получить разные копии модуля (dev, HMR) — очередь должна быть одна
const g = globalThis as { __irisJobs?: Map<string, Job> };
const jobs = (g.__irisJobs ??= new Map<string, Job>());
const TTL_MS = 60 * 60 * 1000;
const sweep = () => { const now = Date.now(); jobs.forEach((j, id) => { if (now - j.createdAt > TTL_MS) jobs.delete(id); }); };

export const getJob = (id: string) => jobs.get(id);

/** Итог по выполненной очереди — одной фразой на языке просьбы. */
export function jobSummary(results: JobResult[], userText: string): string {
    const lang = langOf(userText);
    const ok = results.filter((r) => !r.error).length;
    const waiting = results.reduce((n, r) => n + r.actions.length, 0);
    const T = {
        ru: { all: `Готово: выполнено задач — ${ok} из ${results.length}.`, wait: ` Ждут подтверждения: ${waiting}.`, fail: ` Не удалось: ${results.length - ok}.` },
        uk: { all: `Готово: виконано завдань — ${ok} з ${results.length}.`, wait: ` Чекають підтвердження: ${waiting}.`, fail: ` Не вдалося: ${results.length - ok}.` },
        de: { all: `Erledigt: ${ok} von ${results.length} Aufgaben.`, wait: ` Warten auf Bestätigung: ${waiting}.`, fail: ` Fehlgeschlagen: ${results.length - ok}.` },
        en: { all: `Done: ${ok} of ${results.length} tasks completed.`, wait: ` Waiting for confirmation: ${waiting}.`, fail: ` Failed: ${results.length - ok}.` },
    }[lang];
    return T.all + (results.length - ok ? T.fail : "") + (waiting ? T.wait : "") + (results.length === ok && !waiting && results.length === 1 ? ` ${doneReply(userText)}` : "");
}

/** Выполняет задачи по очереди; onResult вызывается после каждой. Следующая задача видит итоги предыдущих (чтобы «эту карточку» было понятно). */
export async function runTasks(ctx: AiCtx, base: RunOpts, tasks: string[], onResult: (r: JobResult) => void | Promise<void>): Promise<JobResult[]> {
    const results: JobResult[] = [];
    const prior = base.history.slice(0, -1); // сама длинная просьба заменяется отдельными задачами
    const carried: RunOpts["history"] = [];
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        let r: JobResult;
        try {
            // Задача может не уложиться в шаги одного круга: тогда повторяем с описанием сделанного (до двух раз), а не сдаёмся
            let current = task, res: ChatResult | null = null;
            const carriedActions: ChatResult["actions"] = [], carriedExecuted: NonNullable<ChatResult["executed"]> = [], carriedSteps: string[] = [];
            for (let attempt = 0; attempt < 3 && !res; attempt++) {
                try {
                    res = await runChat(ctx, { ...base, noQueue: true, history: [...prior, ...carried.slice(-6), { role: "user", text: current }] });
                } catch (e) {
                    if (!(e instanceof StepBudgetError) || attempt === 2) throw e;
                    // что уже предложено/выполнено в прерванном круге, не теряем: оно войдёт в итог задачи
                    carriedActions.push(...e.actions); carriedExecuted.push(...e.executed); carriedSteps.push(...e.steps);
                    current = continuationTask(task, e.progress);
                }
            }
            const merged = { ...res!, actions: [...carriedActions, ...res!.actions], steps: [...carriedSteps, ...res!.steps], ...(carriedExecuted.length || res!.executed?.length ? { executed: [...carriedExecuted, ...(res!.executed ?? [])] } : {}) };
            r = { ...merged, task, index: i };
        } catch (e) {
            r = { reply: e instanceof Error && e.message ? e.message : "The task failed", steps: [], actions: [], task, index: i, error: true };
        }
        results.push(r);
        carried.push({ role: "user", text: task }, { role: "assistant", text: r.reply });
        await onResult(r);
    }
    return results;
}

export function startJob(ctx: AiCtx, base: RunOpts, tasks: string[]): Job {
    sweep();
    const job: Job = { id: randomUUID(), org: ctx.org, userId: ctx.userId, total: tasks.length, results: [], status: "running", summary: "", createdAt: Date.now() };
    jobs.set(job.id, job);
    const lastUser = base.history[base.history.length - 1]?.text ?? "";
    void runTasks(ctx, base, tasks, (r) => { job.results.push(r); })
        .then((all) => { job.summary = jobSummary(all, lastUser); })
        .catch(() => { job.summary = jobSummary(job.results, lastUser); })
        .finally(() => { job.status = "done"; });
    return job;
}
