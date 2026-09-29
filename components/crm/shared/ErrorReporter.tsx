"use client";
import { useEffect } from "react";

// Ловит то, что иначе остаётся только в консоли браузера: необработанные исключения и промисы,
// которые никто не поймал. Отправляет их на сервер, а оттуда они уходят владельцу в Telegram
// (lib/reportError.ts). Своих сообщений не показывает: пользователь о поломке не должен думать.
export default function ErrorReporter() {
    useEffect(() => {
        const send = (kind: string, message: string, stack?: string, url?: string) => {
            try {
                void fetch("/api/client-error", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind, message: message.slice(0, 500), stack: (stack ?? "").slice(0, 2000), url: (url ?? location.href).slice(0, 300) }),
                    keepalive: true,
                });
            } catch {
                // отчёт об ошибке не должен мешать странице работать
            }
        };
        const onError = (e: ErrorEvent) => send("исключение", e.message || "без описания", e.error?.stack, e.filename);
        const onRejection = (e: PromiseRejectionEvent) => {
            const reason = e.reason as unknown;
            send("отклонённый промис", reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : "");
        };
        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        return () => {
            window.removeEventListener("error", onError);
            window.removeEventListener("unhandledrejection", onRejection);
        };
    }, []);
    return null;
}
