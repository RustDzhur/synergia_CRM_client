import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { reportError } from "@/lib/reportError";

export const dynamic = "force-dynamic";

// Вебхук для сборок: сломанный деплой на Vercel и упавшая сборка в GitHub должны попадать в тот же
// Telegram, что и ошибки приложения — иначе о поломке узнаёшь, только зайдя в панель.
//
// Настраивается в двух местах (см. docs/PLATFORM.md):
//   Vercel → Project → Settings → Webhooks → https://<домен>/api/hooks/deploy?secret=<DEPLOY_HOOK_SECRET>
//   GitHub → репозиторий → Settings → Webhooks → тот же адрес, content type application/json
// Без переменной DEPLOY_HOOK_SECRET маршрут выключен: публичная ручка, которую может дёрнуть кто угодно,
// хуже, чем отсутствие уведомлений.
//
// Отвечаем всегда 200 (кроме отказа по секрету): Vercel и GitHub считают не-2xx сбоем доставки и будут
// повторять запрос, а повтор ничего не изменит — сообщение уже ушло или уже отброшено троттлингом.

function allowed(secret: string | null, expected: string): boolean {
    if (!expected || !secret) return false;
    const a = Buffer.from(secret);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

// Что случилось и куда смотреть. Разбираем только то, что нам нужно, остальное игнорируем молча:
// вебхуки шлют много событий, и «успешная сборка» — не повод для сообщения.
function describe(type: string, body: Record<string, unknown>): { text: string; detail: Record<string, unknown> } | null {
    // Vercel: { type: "deployment.error", payload: { url, target, meta: { githubCommitRef, githubCommitMessage } } }
    if (type.startsWith("deployment.")) {
        const payload = (body.payload ?? {}) as Record<string, unknown>;
        if (type !== "deployment.error") return null;
        const meta = (payload.meta ?? {}) as Record<string, unknown>;
        return {
            text: `Сборка на Vercel не удалась (${payload.target ?? "production"}): ${payload.url ?? ""}`,
            detail: { ветка: meta.githubCommitRef, коммит: meta.githubCommitMessage, автор: meta.githubCommitAuthorLogin, проект: payload.name },
        };
    }
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
    // У Vercel тип события лежит в теле, у GitHub — в заголовке
    const type = String(body.type ?? req.headers.get("x-github-event") ?? "").toLowerCase();
    const failure = describe(type, body);
    if (!failure) return NextResponse.json({ ok: true, ignored: type || "unknown" });

    await reportError(new Error(failure.text), { where: "сборка", detail: failure.detail });
    return NextResponse.json({ ok: true });
}
