// Разметка исходящего письма. Композер присылает HTML из редактора (панель форматирования,
// вставка текста, диктовка), сервер обязан проверить его перед отправкой: письмо уходит чужим
// людям, и скрипт, случайно попавший в письмо из буфера обмена, не должен уехать адресату.
// Плановый текст (text/plain) — запасной вариант для почтовых клиентов без HTML.

const MAX_HTML = 300_000;

export function escapeHtml(text: string): string {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Обычный текст → HTML: строки сохраняются, разметка не исполняется
export const textToHtml = (text: string): string => escapeHtml(String(text ?? "").replace(/\r\n?/g, "\n")).replace(/\n/g, "<br>");

// HTML → обычный текст для text/plain-части. Грубо, но предсказуемо: письмо не должно
// приезжать в клиент без HTML как одна склеенная строка.
export function htmlToText(html: string): string {
    return String(html ?? "")
        .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, n: string) => {
            const code = Number(n);
            return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
        })
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// Разрешённые теги редактора письма. Всё остальное вырезается вместе с содержимым: script,
// iframe, object, embed, form и поля ввода в письме не нужны, а опасны.
// Одиночные теги (input/link/meta/base) удаляются отдельно: у них нет закрывающего, и общее
// правило «до конца документа» съело бы весь текст после такого тега.
const DROP_WITH_CONTENT = /<(script|style|iframe|object|form|textarea|select|button|svg|math)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;
const DROP_VOID = /<(input|link|meta|base|embed)\b[^>]*>/gi;

/** Очистить HTML перед сохранением черновика и отправкой. Сохраняет форматирование панели. */
export function sanitizeOutgoingHtml(html: string): string {
    let s = String(html ?? "").slice(0, MAX_HTML);
    s = s.replace(/<!--[\s\S]*?-->/g, "");
    s = s.replace(DROP_WITH_CONTENT, "");
    s = s.replace(DROP_VOID, "");
    // обработчики событий on*="…" и on*=без-кавычек
    s = s.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    // Опасные схемы в ссылках и картинках (javascript:/vbscript:/data:text/html) — и в кавычках, и без.
    // Заменяем только значение атрибута, а не весь текст письма: «javascript:» в обычной фразе — это текст.
    s = s.replace(/\b(href|src|background)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (match: string, attr: string) =>
        /(?:javascript|vbscript)\s*:|data:text\/html/i.test(match) ? `${attr}="#"` : match
    );
    return s.trim();
}
