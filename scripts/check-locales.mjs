// Проверка переводов: три локали должны иметь одинаковый набор ключей и не иметь пустых строк.
// Запуск: node scripts/check-locales.mjs (в сборке — до next build). Ненулевой код выхода — есть расхождения.
//
// Зачем: интерфейс трёхъязычный (de/en/ua), и забытый ключ в одной локали выглядит как ключ вместо
// текста у части клиентов. Скрипт ловит это до сборки, а не на телефоне у клиента.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locales = ["de", "en", "ua"];
const messages = Object.fromEntries(locales.map((l) => [l, JSON.parse(readFileSync(join(root, "messages", `${l}.json`), "utf8"))]));

const flat = (obj, prefix = "") => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flat(v, key));
        else out[key] = v;
    }
    return out;
};

let problems = 0;
const maps = Object.fromEntries(locales.map((l) => [l, flat(messages[l])]));

for (const locale of locales) {
    const missingInThis = [];
    for (const other of locales) {
        if (other === locale) continue;
        for (const key of Object.keys(maps[other])) {
            if (!(key in maps[locale])) missingInThis.push(key);
        }
    }
    if (missingInThis.length) {
        problems += missingInThis.length;
        console.error(`[${locale}] нет ${missingInThis.length} ключей, например: ${missingInThis.slice(0, 10).join(", ")}`);
    }
    const empty = Object.entries(maps[locale]).filter(([, v]) => typeof v === "string" && v.trim() === "").map(([k]) => k);
    if (empty.length) {
        problems += empty.length;
        console.error(`[${locale}] пустые значения: ${empty.slice(0, 10).join(", ")}`);
    }
}

if (problems) {
    console.error(`\nВсего расхождений: ${problems}`);
    process.exit(1);
}
console.log(`Локали сходятся: ${locales.join(", ")} — одинаковый набор ключей, пустых значений нет`);
