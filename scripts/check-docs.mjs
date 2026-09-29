// Проверка документации: каждый [[ns.key]] из content/docs/*.ts должен существовать в messages/{de,en,ua}.json,
// а подпись не должна содержать подстановок ICU ({…}) или разметки. Запуск: node scripts/check-docs.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const langs = ["de", "en", "ua"];
const messages = Object.fromEntries(langs.map((l) => [l, JSON.parse(readFileSync(join(root, "messages", `${l}.json`), "utf8"))]));
const dir = join(root, "content", "docs");
const get = (m, path) => path.split(".").reduce((n, p) => (n && typeof n === "object" ? n[p] : undefined), m);

let problems = 0;
let labels = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !["resolve.ts", "types.ts", "index.ts"].includes(f))) {
	const src = readFileSync(join(dir, file), "utf8");
	src.split("\n").forEach((line, i) => {
		for (const m of line.matchAll(/\[\[([A-Za-z0-9_.]+)\]\]/g)) {
			labels++;
			for (const l of langs) {
				const v = get(messages[l], m[1]);
				if (typeof v !== "string") { console.log(`${file}:${i + 1} нет ключа ${m[1]} в ${l}`); problems++; }
				else if (/[{}<>]/.test(v)) { console.log(`${file}:${i + 1} ${m[1]} (${l}) содержит {}<>: «${v}»`); problems++; }
			}
		}
		if (/\*\*/.test(line)) { console.log(`${file}:${i + 1} символ ** зарезервирован`); problems++; }
	});
}
console.log(`подписей: ${labels}, проблем: ${problems}`);
process.exit(problems ? 1 : 0);
