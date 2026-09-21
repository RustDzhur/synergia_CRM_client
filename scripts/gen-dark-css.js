// Генератор тёмной темы CRM. Цвета в компонентах заданы прямо в классах Tailwind (bg-[#F5F8FA], text-[#666666], bg-gray…),
// поэтому вместо ручной правки сотен файлов скрипт находит все цветовые классы CRM и для каждого пишет тёмный аналог
// (светлота инвертируется, яркие акценты — синий, красный, зелёный — остаются как есть).
// Результат — app/[locale]/styles/crm-dark.css; правила действуют внутри .dark (класс ставится на <html> в layout CRM).
// Запуск после добавления новых цветовых классов:  node scripts/gen-dark-css.js
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

// палитра и экраны из tailwind.config.ts (читаем текстом, чтобы не собирать TypeScript)
const cfg = fs.readFileSync(path.join(ROOT, "tailwind.config.ts"), "utf8");
const colorsBlock = cfg.match(/colors:\s*\{([\s\S]*?)\n\t\t\},/)[1];
const NAMED = {};
for (const m of colorsBlock.matchAll(/^\s*([A-Za-z0-9]+):\s*"([^"]+)"/gm)) NAMED[m[1]] = m[2];
const SCREENS = { sm: 375, md: 768, mp: 900, lg: 1440 };

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.includes(" 2.")) continue; // конфликтные копии iCloud
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f.name)) out.push(p);
  }
  return out;
}
const files = [...walk(path.join(ROOT, "components/crm")), ...walk(path.join(ROOT, "app/[locale]/crm")), ...walk(path.join(ROOT, "app/utils"))];

const PROP = { bg: "background-color", text: "color", border: "border-color", "border-t": "border-top-color", "border-b": "border-bottom-color", "border-l": "border-left-color", "border-r": "border-right-color", fill: "fill", stroke: "stroke", ring: "--tw-ring-color", divide: "border-color", outline: "outline-color", placeholder: "color" };
const STATES = { hover: ":hover", focus: ":focus", "focus-within": ":focus-within", active: ":active", disabled: ":disabled" };
const re = /(?:^|[\s"'`{(])((?:(?:hover|focus|focus-within|active|disabled|placeholder|group-hover|sm|md|mp|lg):)*)(bg|text|border-t|border-b|border-l|border-r|border|fill|stroke|ring|divide|outline)-(\[#[0-9A-Fa-f]{3,8}\]|[A-Za-z][A-Za-z0-9]*)(?=[\s"'`})\]]|$)/g;

const tokens = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(re)) tokens.add(`${m[1]}${m[2]}-${m[3]}`);
}

const hex2rgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
function rgb2hsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function hsl2hex([h, s, l]) { const f = (n) => { const k = (n + h * 12) % 12; const a = s * Math.min(l, 1 - l); const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, "0"); }; return `#${f(0)}${f(8)}${f(4)}`; }

// Инверсия светлоты по назначению: фон, текст, рамка. Насыщенные цвета (акценты) не трогаем.
function darken(hex, kind) {
  const [h, s, l] = rgb2hsl(hex2rgb(hex));
  if (s > 0.45 && l > 0.25 && l < 0.8) return null; // яркий акцент: синий, красный, зелёный, розовый
  if (kind === "bg") return hsl2hex([h, Math.min(s, 0.25), l > 0.5 ? 0.085 + (1 - l) * 1.15 : Math.min(0.5, 0.5 - (0.5 - l) * 0.4)]);
  if (kind === "border") return hsl2hex([h, Math.min(s, 0.2), l > 0.5 ? 0.16 + (1 - l) * 0.95 : 0.4]);
  if (kind === "text") return l > 0.92 ? null : hsl2hex([h, Math.min(s, 0.3), l < 0.55 ? 0.93 - l * 0.55 : Math.max(0.5, 0.86 - l * 0.4)]); // белый остаётся белым (текст на кнопках)
  return null;
}

const rules = { base: [], md: [], mp: [], lg: [], sm: [] };
const esc = (s) => s.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
for (const tok of [...tokens].sort()) {
  const parts = tok.split(":");
  const util = parts.pop();
  const mm = util.match(/^(bg|text|border-t|border-b|border-l|border-r|border|fill|stroke|ring|divide|outline)-(.+)$/);
  if (!mm) continue;
  const [, kindKey, val] = mm;
  let hex = null;
  if (val.startsWith("[#")) hex = val.slice(1, -1);
  else if (val === "white") hex = "#ffffff";
  else if (NAMED[val]) hex = NAMED[val];
  if (!hex || hex.startsWith("rgba")) continue;
  const isPlaceholder = parts.includes("placeholder");
  const kind = kindKey === "bg" ? "bg" : kindKey === "text" || kindKey === "fill" || kindKey === "stroke" ? "text" : "border";
  const dark = darken(hex, kind);
  if (!dark) continue;
  let selector = "." + esc(tok);
  const states = parts.filter((p) => STATES[p]);
  const bp = parts.find((p) => SCREENS[p]);
  for (const st of states) selector += STATES[st];
  if (isPlaceholder) selector += "::placeholder";
  if (parts.includes("group-hover")) selector = `.group:hover ${selector}`;
  const prop = PROP[kindKey];
  const rule = `.dark ${selector} { ${prop}: ${dark}; }`;
  rules[bp ?? "base"].push(rule);
}

let css = "/* Сгенерировано scripts/gen-dark-css.js — не править вручную */\n";
css += "html.dark { color-scheme: dark; }\nhtml.dark body { background-color: #0d1117; color: #d7dde5; }\n";
css += "html.dark .dark-surface { background-color: #161b22; }\n";
css += rules.base.join("\n") + "\n";
for (const bp of ["sm", "md", "mp", "lg"]) if (rules[bp].length) css += `@media (min-width: ${SCREENS[bp]}px) {\n${rules[bp].join("\n")}\n}\n`;
// обёртки без своих цветовых классов: карточки на bg-white внутри, оверлей модальных окон и тени
css += ".dark .bg-modalBG { background-color: rgba(0, 0, 0, 0.6); }\n";
css += ".dark img { filter: brightness(0.92); }\n";
css += ".dark input, .dark textarea, .dark select { color-scheme: dark; background-color: #161b22; color: #d7dde5; border-color: #2c3440; }\n";
css += ".dark input::placeholder, .dark textarea::placeholder { color: #7d8794; }\n";
css += ".dark table { color: #d7dde5; }\n";
fs.writeFileSync(path.join(ROOT, "app/[locale]/styles/crm-dark.css"), css);
console.log(`tokens: ${tokens.size}, rules: ${Object.values(rules).reduce((a, r) => a + r.length, 0)}`);
