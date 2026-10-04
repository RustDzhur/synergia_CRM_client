"use client";
import { useEffect } from "react";

// Ловит всё, что иначе остаётся только в консоли браузера, и отправляет на сервер (/api/client-error), а оттуда — владельцу в Telegram
// с объяснением (lib/errorHub.ts). Что именно ловится:
//  • необработанные исключения (window.onerror) и отказавшие промисы;
//  • всё, что код пишет в console.error (в том числе предупреждения React о поломках);
//  • запросы к нашему серверу, которые упали (нет связи) или ответили 5xx;
//  • не загрузившиеся файлы страницы (скрипты, стили, картинки);
//  • блокировки политики безопасности (CSP).
// Рядом с каждой ошибкой уходит «что было до»: последние действия (запросы, сообщения консоли) — часто сразу видно причину.
// Своих сообщений человеку не показывает: пользователь о поломке не должен думать. Не чаще 30 отчётов за открытие страницы,
// одинаковые — раз в минуту.
const MAX_REPORTS = 30;
const SAME_MS = 60_000;

export default function ErrorReporter() {
    useEffect(() => {
        const w = window as Window & { __errorReporterOn?: boolean };
        if (w.__errorReporterOn) return;
        w.__errorReporterOn = true;

        const crumbs: string[] = [];
        const crumb = (s: string) => { crumbs.push(`${new Date().toISOString().slice(11, 19)} ${s.slice(0, 140)}`); if (crumbs.length > 10) crumbs.shift(); };
        const seen = new Map<string, number>();
        let sent = 0;

        const send = (kind: string, message: string, stack?: string, url?: string, extra?: Record<string, unknown>) => {
            try {
                const key = `${kind}|${message.slice(0, 120)}`;
                const now = Date.now();
                if (now - (seen.get(key) ?? 0) < SAME_MS || sent >= MAX_REPORTS) return;
                seen.set(key, now);
                sent++;
                void nativeFetch("/api/client-error", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        kind, message: message.slice(0, 600), stack: (stack ?? "").slice(0, 2000), url: (url ?? location.href).slice(0, 300),
                        ua: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}`, lang: document.documentElement.lang, crumbs, extra,
                    }),
                    keepalive: true,
                });
            } catch {
                // отчёт об ошибке не должен мешать странице работать
            }
        };

        // fetch: запоминаем действия и ловим падения запросов к своему серверу (кроме самого отчёта об ошибке — иначе получился бы цикл)
        const nativeFetch = window.fetch.bind(window);
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
            const own = url.startsWith("/") || url.startsWith(location.origin);
            const path = own ? url.replace(location.origin, "").split("?")[0] : "";
            if (own && path.startsWith("/api/client-error")) return nativeFetch(input, init);
            try {
                const res = await nativeFetch(input, init);
                if (own && path.startsWith("/api/")) {
                    crumb(`${method} ${path} → ${res.status}`);
                    if (res.status >= 500) send("fetch", `Запрос ${method} ${path} ответил ${res.status}`, "", undefined, { status: res.status, method });
                }
                return res;
            } catch (e) {
                if (own) {
                    crumb(`${method} ${path} → нет ответа`);
                    // обрыв при уходе со страницы и отмена запроса — не поломка
                    if (!(e instanceof DOMException && e.name === "AbortError") && document.visibilityState === "visible") send("fetch", `Запрос ${method} ${path} не удался: ${e instanceof Error ? e.message : String(e)}`, "", undefined, { method });
                }
                throw e;
            }
        };

        // console.error: то, что код сам считает ошибкой
        const nativeError = console.error;
        console.error = (...args: unknown[]) => {
            nativeError.apply(console, args);
            try {
                const first = args.find((a) => a instanceof Error) as Error | undefined;
                const message = args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })())).join(" ").slice(0, 600);
                crumb(`console.error ${message}`);
                send("console", message, first?.stack);
            } catch { /* не мешаем консоли */ }
        };

        const onError = (e: ErrorEvent | Event) => {
            if (e instanceof ErrorEvent) return void send("error", e.message || "без описания", e.error?.stack, e.filename || undefined);
            // событие error без ErrorEvent — не загрузился файл (img, script, link)
            const el = e.target as (HTMLElement & { src?: string; href?: string }) | null;
            if (el && el !== (window as unknown) && (el.src || el.href)) send("resource", `Не загрузился файл: ${el.src || el.href}`, "", undefined, { target: el.tagName?.toLowerCase() });
        };
        const onRejection = (e: PromiseRejectionEvent) => {
            const reason = e.reason as unknown;
            send("rejection", reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason), reason instanceof Error ? reason.stack : "");
        };
        const onCsp = (e: SecurityPolicyViolationEvent) => send("csp", `Заблокировано политикой безопасности: ${e.blockedURI || "inline"} (${e.violatedDirective})`);

        window.addEventListener("error", onError, true); // capture: иначе события загрузки файлов не всплывают
        window.addEventListener("unhandledrejection", onRejection);
        document.addEventListener("securitypolicyviolation", onCsp);
        return () => {
            window.removeEventListener("error", onError, true);
            window.removeEventListener("unhandledrejection", onRejection);
            document.removeEventListener("securitypolicyviolation", onCsp);
            window.fetch = nativeFetch;
            console.error = nativeError;
            w.__errorReporterOn = false;
        };
    }, []);
    return null;
}
