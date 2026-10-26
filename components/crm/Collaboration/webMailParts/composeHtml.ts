"use client";

// Разметка окна написания письма. Редактор — contentEditable без внешних библиотек (как редактор
// договоров), поэтому весь HTML живёт в браузере, а сюда вынесены чистые операции над ним:
// текст/HTML для отправки, вставка надиктованного текста и команды панели форматирования.

/** Размеры шрифта панели: <font size> понимают все почтовые клиенты, включая старые. */
export const FONT_SIZES = [
    { key: "small", px: 12, size: "2" },
    { key: "normal", px: 14, size: "3" },
    { key: "large", px: 18, size: "5" },
    { key: "huge", px: 24, size: "6" },
] as const;
export type FontSizeKey = (typeof FONT_SIZES)[number]["key"];

/** Палитра текста (необязательная возможность): базовый цвет темы и четыре акцента. */
export const TEXT_COLORS = ["#edf2ff", "#eb5757", "#7c93ff", "#34d399", "#f4b942"] as const;

const escapeHtml = (text: string) => String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Старый черновик без HTML (только текст) → разметка редактора. */
export const textToEditorHtml = (text: string) => escapeHtml(String(text ?? "").replace(/\r\n?/g, "\n")).replace(/\n/g, "<br>");

/** Пустой редактор браузер отдаёт как <br> или <p><br></p> — это не содержимое письма. */
export const isEditorEmpty = (html: string) => {
    const s = String(html ?? "").replace(/<br\s*\/?>|<\/?p>|&nbsp;|\s/gi, "");
    return s === "";
};

/**
 * Вставка надиктованного текста в позицию курсора. Плейн-текст, без разметки — диктовка не должна
 * наследовать жирный шрифт или список, если курсор стоял внутри них. execCommand("insertText")
 * сохраняет историю отмены браузера; если команда недоступна, вставляем текстовый узел вручную.
 */
export function insertDictatedText(root: HTMLElement | null, text: string, savedRange: Range | null): void {
    const clean = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!root || !clean) return;
    root.focus();
    const selection = window.getSelection();
    const range = savedRange && root.contains(savedRange.startContainer) ? savedRange.cloneRange() : null;
    if (range && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    } else if (selection && (selection.rangeCount === 0 || !root.contains(selection.getRangeAt(0).startContainer))) {
        const end = document.createRange();
        end.selectNodeContents(root);
        end.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(end);
    }
    // Пробел перед текстом, если курсор стоит сразу после слова — иначе слова склеятся
    const before = (selection?.isCollapsed ? root.textContent?.slice(-1) : "") ?? "";
    const insert = before && !/\s/.test(before) ? ` ${clean}` : clean;
    let inserted = false;
    try {
        inserted = document.execCommand("insertText", false, insert);
    } catch {
        inserted = false;
    }
    if (!inserted) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const node = document.createTextNode(insert);
        r.insertNode(node);
        r.setStartAfter(node);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
    }
}

/**
 * Команда панели форматирования. Перед выполнением возвращаем каретку в редактор: кнопка панели
 * забирает фокус, и без восстановления команда применилась бы не к выделенному тексту.
 * styleWithCSS выключен: execCommand пишет <b>/<i>/<font>, их понимают почтовые клиенты.
 */
export function execFormat(root: HTMLElement | null, savedRange: Range | null, command: string, value?: string): void {
    if (!root) return;
    root.focus();
    const selection = window.getSelection();
    if (savedRange && selection && root.contains(savedRange.startContainer)) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
    }
    try {
        document.execCommand("styleWithCSS", false, "false");
        document.execCommand(command, false, value);
    } catch {
        /* команда недоступна в этом браузере — кнопка просто ничего не меняет */
    }
}

/** Язык диктовки: выбранный язык голосового ассистента (тот же ключ), иначе язык интерфейса. */
export function dictationLanguage(locale: string): string {
    try {
        const saved = localStorage.getItem("ai.agent.lang");
        if (saved && ["ru", "uk", "de", "en", "uz"].includes(saved)) return saved;
    } catch {
        /* приватный режим */
    }
    return locale === "ua" ? "uk" : ["de", "en", "uz"].includes(locale) ? locale : "en";
}
