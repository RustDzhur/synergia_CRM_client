// Разметка письма приходит от чужих людей, поэтому показывать её как есть нельзя: скрипты, обработчики
// событий и переходы вида javascript: вырезаем, ссылки открываем в новой вкладке, а сам результат
// показываем в песочнице (iframe без allow-scripts) — даже если что-то проскочит, доступ к CRM оно
// не получит. Так письмо выглядит как оригинал: со ссылками, картинками и вёрсткой.

// Теги, которые оставляем. Всё остальное разворачиваем: содержимое остаётся, обёртка исчезает.
const ALLOWED_TAGS = new Set([
    "a", "abbr", "address", "article", "aside", "b", "bdi", "big", "blockquote", "br", "caption", "center", "cite",
    "code", "col", "colgroup", "dd", "del", "details", "dfn", "div", "dl", "dt", "em", "figcaption", "figure",
    "font", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "i", "img", "ins", "kbd", "label", "li",
    "main", "mark", "nav", "ol", "p", "pre", "q", "s", "samp", "section", "small", "span", "strike", "strong",
    "style", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "tt", "u", "ul", "var", "wbr",
]);

// Разрешённые атрибуты. Всё, что начинается с on (обработчики), и всё, чего нет в списке, убираем.
const ALLOWED_ATTRS = new Set([
    "align", "alt", "background", "bgcolor", "border", "cellpadding", "cellspacing", "class", "color", "colspan",
    "dir", "face", "height", "href", "lang", "rel", "rowspan", "size", "src", "style", "target", "title", "valign", "width",
]);

const SAFE_URL = /^(https?:|mailto:|tel:|#|cid:)/i;

export function sanitizeMailHtml(html: string): string {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    // Список берём сразу: развёрнутые элементы остаются в нём, и их содержимое тоже будет проверено
    for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) {
        const tag = el.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
            el.replaceWith(...Array.from(el.childNodes));
            continue;
        }
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            const value = attr.value.replace(/[\u0000-\u001f\s]+/g, "");
            if (!ALLOWED_ATTRS.has(name) || name.startsWith("on") || ((name === "href" || name === "src" || name === "background") && !SAFE_URL.test(value))) {
                el.removeAttribute(attr.name);
            }
        }
        if (tag === "a" && el.getAttribute("href")) {
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
        }
    }
    return doc.body.innerHTML;
}

// Документ для песочницы: строгая политика (никаких скриптов и форм), свои стили для читаемости
// в тёмной теме и запрет выходить по ссылкам в самом окне письма
export function mailSrcDoc(html: string): string {
    const csp = "default-src 'none'; img-src https: http: data: cid:; style-src 'unsafe-inline'; font-src https: http: data:; media-src https: http:; form-action 'none'";
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank">
<style>
    html { color-scheme: dark; }
    body { margin: 0; padding: 2px; font: 400 13px/1.55 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #f1f4ee; background: transparent; overflow-wrap: anywhere; }
    a { color: #c6ff4d; }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
    blockquote { margin: 8px 0; padding-left: 10px; border-left: 2px solid rgba(255,255,255,0.2); }
    pre { white-space: pre-wrap; }
</style></head><body>${html}</body></html>`;
}
