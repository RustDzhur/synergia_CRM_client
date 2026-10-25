#!/usr/bin/env node
// Экспорт опубликованных статей блога для НОВОГО сайта (firmspace-website, статические content/blog/*.json).
// Запускается ИЗ контейнера CRM (docker exec firmspace-crm node scripts/sync-blog.mjs): здесь есть БД и Prisma.
// Печатает в stdout по строке NDJSON на статью: { slug, data, src } — файлы и картинки раскладывает
// обёртка на хосте deploy/vps/sync-blog.sh (в контейнер /home/server не смонтирован).
//   data — схема сайта: { slug, title{de,en,ua}, excerpt{de,en,ua}, body[{de,en,ua}], publishedAt, image }
//   src  — исходная картинка поста: /images/blog/… (файл в public/images/blog) или http(s)-URL; "" — картинки нет.
// Языки сайта — de/en/ru: робот пишет их сам. ua/uz в CRM остаются, но на сайт не выгружаются.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LANGS = ["de", "en", "ru"]; // языки сайта: немецкий, английский, русский

const plain = (v) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\r/g, "").trim();

// {en,de,ua,uz} → {de,en,ua}; пустой язык — текст en (посетитель увидит хотя бы английскую версию)
const localize = (json) => {
    const o = (json && typeof json === "object" ? json : {});
    const en = plain(o.en);
    const out = {};
    for (const l of LANGS) out[l] = plain(o[l]) || en;
    return out;
};

try {
    const rows = await prisma.blogPost.findMany({ where: { published: true }, orderBy: { publishedAt: "asc" } });
    for (const r of rows) {
        const data = {
            slug: r.slug,
            title: localize(r.title),
            excerpt: localize(r.excerpt),
            body: (Array.isArray(r.body) ? r.body : []).map((p) => localize(p)),
            publishedAt: new Date(r.publishedAt).toISOString().slice(0, 10),
            image: `/images/blog/${r.slug}.jpg`,
        };
        process.stdout.write(`${JSON.stringify({ slug: r.slug, data, src: String(r.image ?? "") })}\n`);
    }
} finally {
    await prisma.$disconnect();
}
