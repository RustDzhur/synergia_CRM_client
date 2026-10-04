"use client";
import { useEffect } from "react";

// Поломка самого корневого шаблона (то, что не ловит error.tsx внутри языка): страница целиком заменяется этим сообщением, а ошибка
// уходит владельцу так же, как остальные клиентские.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        try {
            void fetch("/api/client-error", {
                method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
                body: JSON.stringify({ kind: "render", message: `Корневой шаблон: ${error.name}: ${error.message}`.slice(0, 600), stack: (error.stack ?? "").slice(0, 2000), url: location.href, ua: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}`, extra: { target: error.digest ?? "" } }),
            });
        } catch { /* отчёт не должен ломать страницу ошибки */ }
    }, [error]);
    return (
        <html lang="en">
            <body style={{ margin: 0, background: "#0a0c0b", color: "#f1f4ee", fontFamily: "system-ui, sans-serif" }}>
                <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
                    <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
                    <p style={{ maxWidth: 420, color: "#8c948b", fontSize: 14 }}>The site could not be loaded. The error has been reported.</p>
                    <button type="button" onClick={reset} style={{ height: 40, padding: "0 20px", borderRadius: 999, border: 0, background: "#c6ff4d", color: "#0a0c0b", fontWeight: 600, cursor: "pointer" }}>Try again</button>
                </main>
            </body>
        </html>
    );
}
