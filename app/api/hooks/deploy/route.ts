import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";

// Вебхук для сборок: упавшая сборка в GitHub должна попадать в тот же Telegram, что и ошибки приложения —
// иначе о поломке узнаёшь, только зайдя в панель.
//
// Второе назначение — ТРИГГЕР ВЫКЛАДКИ. CI публикует зелёный коммит в ветку выкладки, GitHub шлёт сюда
// событие push, маршрут кладёт файл-флаг в каталог, смонтированный с хоста, а на сервере за ним следит
// systemd-путь (deploy/vps/trigger/firmspace-deploy.path): он запускает deploy/vps/autodeploy.sh сразу,
// не дожидаясь двухминутного cron. Без флага и юнита выкладка идёт по cron как раньше — триггер дополняет,
// а не заменяет его.
//
// Настраивается так (см. docs/PLATFORM.md):
//   GitHub → репозиторий → Settings → Webhooks → https://<домен>/api/hooks/deploy?secret=<DEPLOY_HOOK_SECRET>,
//   content type application/json, события: push и workflow_run.
// Без переменной DEPLOY_HOOK_SECRET маршрут выключен: публичная ручка, которую может дёрнуть кто угодно,
// хуже, чем отсутствие уведомлений.
//
// Отвечаем всегда 200 (кроме отказа по секрету): GitHub считает не-2xx сбоем доставки и будут
// повторять запрос, а повтор ничего не изменит — сообщение уже ушло или уже отброшено троттлингом.

function allowed(secret: string | null, expected: string): boolean {
    if (!expected || !secret) return false;
    const a = Buffer.from(secret);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

// Файл-триггер: путь внутри контейнера, каталог приходит с хоста (deploy/vps/docker-compose.yml).
const TRIGGER_FILE = process.env.DEPLOY_TRIGGER_FILE || "/deploy-request/request";
const TRIGGER_BRANCH = process.env.DEPLOY_HOOK_BRANCH || "deploy";

/** Кладём флаг для systemd-пути/скрипта выкладки. Ошибку не поднимаем: cron всё равно выложит по расписанию. */
async function requestDeploy(sha: string): Promise<boolean> {
    try {
        await mkdir(dirname(TRIGGER_FILE), { recursive: true });
        await writeFile(TRIGGER_FILE, `${new Date().toISOString()} ${sha}\n`);
        return true;
    } catch {
        return false;
    }
}

// Что случилось и куда смотреть. Разбираем только то, что нам нужно, остальное игнорируем молча:
// вебхуки шлют много событий, и «успешная сборка» — не повод для сообщения.
function describe(type: string, body: Record<string, unknown>): { text: string; detail: Record<string, unknown> } | null {
    // GitHub: X-GitHub-Event в заголовке, тело — как у события
    if (type === "workflow_run") {
        const run = (body.workflow_run ?? {}) as Record<string, unknown>;
        if (body.action !== "completed" || !["failure", "timed_out", "startup_failure"].includes(String(run.conclusion))) return null;
        return {
            text: `Сборка в GitHub не удалась: ${run.name ?? "workflow"} (${run.conclusion})`,
            detail: { ветка: run.head_branch, ссылка: run.html_url, коммит: run.head_sha },
        };
    }
    if (type === "deployment_status") {
        const status = (body.deployment_status ?? {}) as Record<string, unknown>;
        const deployment = (body.deployment ?? {}) as Record<string, unknown>;
        if (!["failure", "error"].includes(String(status.state))) return null;
        return { text: `Деплой в GitHub не удался (${status.state})`, detail: { окружение: deployment.environment, ссылка: status.target_url } };
    }
    return null;
}

export async function POST(req: Request) {
    const expected = process.env.DEPLOY_HOOK_SECRET ?? "";
    const fromQuery = new URL(req.url).searchParams.get("secret");
    if (!allowed(fromQuery ?? req.headers.get("x-hook-secret"), expected)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Тип события GitHub лежит в заголовке
    const type = String(req.headers.get("x-github-event") ?? "").toLowerCase();

    // push в ветку выкладки — просим сервер пересобраться немедленно (файл-триггер для systemd-пути)
    if (type === "push") {
        const branch = String(body.ref ?? "").replace("refs/heads/", "");
        if (branch !== TRIGGER_BRANCH) return NextResponse.json({ ok: true, ignored: `branch ${branch || "?"}` });
        const sha = String(body.after ?? "").slice(0, 40);
        const triggered = await requestDeploy(sha);
        return NextResponse.json({ ok: true, triggered, branch, commit: sha.slice(0, 7) });
    }

    const failure = describe(type, body);
    if (!failure) return NextResponse.json({ ok: true, ignored: type || "unknown" });

    await reportError(new Error(failure.text), { where: "сборка", detail: failure.detail });
    return NextResponse.json({ ok: true });
}
