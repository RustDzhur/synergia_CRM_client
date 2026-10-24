#!/usr/bin/env node
// Картинка для статьи блога: берёт УНИКАЛЬНУЮ картинку из Openverse (только CC0 / Public Domain),
// приводит к 1200×630 (sharp — зависимость приложения, без внешних бинарей), кладёт в public/images/blog/<slug>.jpg
// и дублирует на том /data/storage/blog-images (переживает пересборки контейнера — оттуда её заберёт sync-blog.sh,
// даже если контейнер пересоздался раньше синхронизации). Журнал использованных картинок — на томе /data/storage.
// Запуск: node scripts/fetch-blog-image.mjs <slug> "<поисковый запрос>"
import { writeFileSync, existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const [, , slug, ...rest] = process.argv;
const query = rest.join(" ").trim();
if (!slug || !/^[A-Za-z0-9._-]{1,80}$/.test(slug)) {
    console.error('usage: fetch-blog-image <slug> "<query>"');
    process.exit(2);
}

const ROOT = process.cwd(); // /app внутри контейнера CRM
const PUBLIC_DIR = join(ROOT, "public/images/blog");
const STORAGE_DIR = process.env.BLOG_IMAGE_DIR || "/data/storage/blog-images";
const JOURNAL = join(dirname(STORAGE_DIR), "blog-used-images.jsonl");
const UA = { "User-Agent": "firmspace-blog/1.0 (https://firmspace.de)" };
const target = join(PUBLIC_DIR, `${slug}.jpg`);
const durable = join(STORAGE_DIR, `${slug}.jpg`);
if (existsSync(target)) { console.log(`/images/blog/${slug}.jpg`); process.exit(0); }
mkdirSync(PUBLIC_DIR, { recursive: true });
mkdirSync(STORAGE_DIR, { recursive: true });

const used = new Set(
    existsSync(JOURNAL)
        ? readFileSync(JOURNAL, "utf8").trim().split("\n").filter(Boolean)
            .map((l) => { try { return JSON.parse(l).url; } catch { return null; } })
            .filter(Boolean)
        : []
);

// Каскад запросов: точный → покороче → общие темы (картинка находится почти всегда)
const apiUrl = (q) =>
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&page_size=20&mature=false`;
const queries = [query, query.split(/\s+/).slice(0, 2).join(" "), "artificial intelligence", "business technology", "technology"]
    .filter((q, i, a) => q && q.trim() && a.indexOf(q) === i);

let pick = null;
for (const q of queries) {
    if (!q) continue;
    const data = await (await fetch(apiUrl(q), { headers: UA })).json();
    const results = (data.results || []).filter((r) => (r.width || 0) >= 900 && (r.height || 0) >= 500 && !used.has(r.url));
    if (results.length) { pick = results[0]; break; }
}
if (!pick) {
    console.error("нет подходящей неиспользованной картинки для запроса: " + query);
    process.exit(1);
}

const raw = join(tmpdir(), `blog-${slug}-raw`);
const buf = Buffer.from(await (await fetch(pick.url, { headers: UA })).arrayBuffer());
if (buf.length < 5000) {
    console.error(`скачанный файл слишком мал (${buf.length} б)`);
    process.exit(1);
}
writeFileSync(raw, buf);
await sharp(raw).resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 82 }).toFile(target);
writeFileSync(durable, readFileSync(target)); // копия на томе: переживает пересоздание контейнера

appendFileSync(
    JOURNAL,
    JSON.stringify({ slug, query, url: pick.url, title: pick.title, license: pick.license, creator: pick.creator, path: `/images/blog/${slug}.jpg`, at: new Date().toISOString() }) + "\n"
);

console.log(`/images/blog/${slug}.jpg`);
