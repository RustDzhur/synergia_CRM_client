"use client";
import { useEffect } from "react";

// Страница не отрисовалась из-за исключения в компоненте: показываем спокойное сообщение с кнопкой «повторить», а ошибку отправляем
// владельцу (/api/client-error → Telegram с объяснением). Текст на трёх языках — по адресу страницы, без зависимости от провайдера переводов:
// именно он мог быть причиной поломки.
const TEXT: Record<string, { title: string; text: string; retry: string }> = {
    ua: { title: "Щось пішло не так", text: "Сторінка не завантажилась. Ми вже отримали повідомлення про помилку.", retry: "Спробувати ще раз" },
    de: { title: "Etwas ist schiefgelaufen", text: "Die Seite konnte nicht geladen werden. Wir haben die Fehlermeldung bereits erhalten.", retry: "Erneut versuchen" },
    en: { title: "Something went wrong", text: "The page could not be loaded. We have already received the error report.", retry: "Try again" },
};

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        try {
            void fetch("/api/client-error", {
                method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
                body: JSON.stringify({ kind: "render", message: `${error.name}: ${error.message}`.slice(0, 600), stack: (error.stack ?? "").slice(0, 2000), url: location.href, ua: navigator.userAgent, viewport: `${innerWidth}x${innerHeight}`, extra: { target: error.digest ?? "" } }),
            });
        } catch { /* отчёт не должен ломать страницу ошибки */ }
    }, [error]);
    const lang = typeof location !== "undefined" ? (location.pathname.split("/")[1] ?? "") : "";
    const t = TEXT[lang] ?? TEXT.en;
    return (
        <main style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center", color: "#f1f4ee", background: "#0a0c0b" }}>
            <h1 style={{ fontSize: 22, fontWeight: 600 }}>{t.title}</h1>
            <p style={{ maxWidth: 420, color: "#8c948b", fontSize: 14 }}>{t.text}</p>
            <button type="button" onClick={reset} style={{ marginTop: 8, height: 40, padding: "0 20px", borderRadius: 999, border: 0, background: "#c6ff4d", color: "#0a0c0b", fontWeight: 600, cursor: "pointer" }}>{t.retry}</button>
        </main>
    );
}
