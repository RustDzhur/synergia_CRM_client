// «Найди на экране»: Айрис просит браузер найти строку/карточку с текстом, прокрутить к ней и подсветить зелёным (класс iris-hit,
// стили — в globals.css). Всё делается в браузере человека по тому, что реально отображено на странице.

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const ROW = "tr, li, [role='row'], [role='listitem'], article, [data-row]";

/** Строки/карточки страницы, в тексте которых есть искомое; панель Айрис ([data-iris-hud]) и скрытые элементы не считаются. */
export function findMatches(doc: Document, text: string, limit = 5): HTMLElement[] {
    const needle = norm(text);
    if (needle.length < 2) return [];
    const found: HTMLElement[] = [];
    const add = (el: HTMLElement | null) => {
        if (!el || found.includes(el) || found.length >= limit) return;
        if (found.some((f) => f.contains(el) || el.contains(f))) return; // строка и её ячейка — одно совпадение
        const box = el.getBoundingClientRect?.();
        if (box && box.width === 0 && box.height === 0) return; // скрыт
        found.push(el);
    };
    // 1) текст узла содержит искомое → подсвечиваем ближайшую строку/карточку (или сам элемент)
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && found.length < limit; n = walker.nextNode()) {
        const parent = n.parentElement;
        if (!parent || parent.closest("[data-iris-hud], script, style, noscript")) continue;
        if (!norm(n.textContent ?? "").includes(needle)) continue;
        add(parent.closest(ROW) as HTMLElement | null ?? parent);
    }
    // 2) искомое разбито по соседним элементам строки («ART-0004» отдельно от названия) → строки целиком
    if (!found.length) {
        const rows = Array.from(doc.querySelectorAll<HTMLElement>(ROW)).filter((el) => !el.closest("[data-iris-hud]") && norm(el.textContent ?? "").includes(needle));
        rows.filter((el) => !rows.some((o) => o !== el && el.contains(o))).forEach(add); // самые вложенные
    }
    return found;
}

/** Ищет, пока страница открывается (вкладки и таблицы подгружаются не сразу), подсвечивает и прокручивает к первой найденной. */
export function runFind(doc: Document, text: string, opts: { timeoutMs?: number; holdMs?: number } = {}): () => void {
    const timeoutMs = opts.timeoutMs ?? 8000, holdMs = opts.holdMs ?? 25000;
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, clear: (() => void) | undefined;
    const started = Date.now();
    const clearAll = () => doc.querySelectorAll(".iris-hit").forEach((el) => el.classList.remove("iris-hit"));
    const attempt = () => {
        if (stopped) return;
        const hits = findMatches(doc, text);
        if (!hits.length) {
            if (Date.now() - started < timeoutMs) timer = setTimeout(attempt, 250);
            return;
        }
        clearAll();
        hits.forEach((el) => el.classList.add("iris-hit"));
        hits[0].scrollIntoView({ behavior: "smooth", block: "center" });
        // подсветка держится, пока человек не нажмёт куда-нибудь (не сразу — чтобы не снять её тем же кликом) или не пройдёт время
        const off = () => { clearAll(); doc.removeEventListener("pointerdown", onDown, true); clearTimeout(hold); };
        const onDown = () => off();
        const hold = setTimeout(off, holdMs);
        setTimeout(() => { if (!stopped) doc.addEventListener("pointerdown", onDown, true); }, 1200);
        clear = off;
    };
    attempt();
    return () => { stopped = true; if (timer) clearTimeout(timer); clear?.(); };
}
