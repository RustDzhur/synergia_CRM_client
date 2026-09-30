// Проверка CSS-классов Tailwind: шкала в tailwind.config.ts ЗАМЕНЯЕТ стандартную, поэтому класс
// вида w-220 при отсутствии ключа 220 молча не даёт CSS (не ошибка сборки — просто «ничего не видно»).
// Скрипт сканирует tsx/ts и падает, если число в спейсинг-классе не описано в конфиге.
//   node scripts/check-tw.mjs
import { readFileSync } from "fs";
import { execSync } from "child_process";

const cfg = readFileSync("tailwind.config.ts", "utf8");
// Достаём объект шкалы честным подсчётом скобок: простые регулярки спотыкаются на вложенных
// объектах (у fontSize значения — объекты со своими фигурными скобками).
const block = (name) => {
    const start = cfg.indexOf(name + ": {");
    if (start === -1) return new Set();
    let i = cfg.indexOf("{", start);
    let depth = 0;
    for (let j = i; j < cfg.length; j++) {
        if (cfg[j] === "{") depth++;
        else if (cfg[j] === "}") { depth--; if (depth === 0) { i = j; break; } }
    }
    const body = cfg.slice(start, i);
    // ключи верхнего уровня: строка вида «220: "220px",» или «xxl: { ... }» — числа нас интересуют
    return new Set([...body.matchAll(/^\s*"?(\d+)"?:/gm)].map((x) => x[1]));
};
const spacing = block("spacing");
const radius = block("borderRadius");
const fontSize = block("fontSize");
const opacity = block("opacity");

const files = execSync("git ls-files '*.tsx' '*.ts' | grep -v node_modules", { encoding: "utf8" }).trim().split("\n");
const pat = /\b(w|h|min-w|max-w|min-h|max-h|gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr|space-y|space-x|top|bottom|left|right|inset|rounded|text|opacity)-(\d+)\b/g;
let bad = 0;
for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(pat)) {
        const [, prefix, num] = m;
        const scale = prefix === "rounded" ? radius : prefix === "text" ? fontSize : prefix === "opacity" ? opacity : spacing;
        // text-<число> в проекте также задаёт цвет? нет — цвета идут как text-[...] или текст-<key> из fontSize
        if (!scale.has(num)) {
            bad++;
            console.error(`${f}: ${prefix}-${num} — нет ключа ${num} в шкале (CSS молча не создастся)`);
        }
    }
}
if (bad) { console.error(`Всего классов вне шкалы: ${bad}`); process.exit(1); }
console.log(`Классы Tailwind: все числа описаны в шкале (${files.length} файлов)`);
