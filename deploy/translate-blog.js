/**
 * Перевод статей блога нового сайта на русский.
 *
 * Запускается из sync-blog.sh ДО пересборки сайта: находит JSON-файлы без
 * поля `ru`, просит CRM перевести их (POST /api/cron/translate-blog, тот же
 * ИИ, что пишет статьи) и вписывает title/excerpt/body по-русски.
 * Идемпотентно: уже переведённые файлы не трогаются; при ошибке файл
 * остаётся как был (страница покажет en — не пустоту).
 */
const fs = require("node:fs");
const path = require("node:path");

const BLOG_DIR = process.env.BLOG_DIR || "/home/server/firmspace-website/content/blog";
const API = process.env.CRM_URL || "http://127.0.0.1:3210";
const BATCH = Number(process.env.TRANSLATE_BATCH || 3);

function secret() {
  for (const file of ["/home/server/crm-duplicate/deploy/vps/.env", "/home/server/crm-duplicate/deploy/.env"]) {
    try {
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (line.startsWith("CRON_SECRET=")) return line.split("=").slice(1).join("=").trim().replace(/^"|"$/g, "");
      }
    } catch {
      /* нет файла — пробуем следующий */
    }
  }
  return process.env.CRON_SECRET || "";
}

async function translate(items) {
  const res = await fetch(`${API}/api/cron/translate-blog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret()}` },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.items)) throw new Error("translate: no items in response");
  return data.items;
}

async function main() {
  if (!fs.existsSync(BLOG_DIR)) {
    console.log("translate-blog: нет папки", BLOG_DIR);
    return;
  }
  const files = fs.readdirSync(BLOG_DIR).filter((name) => name.endsWith(".json"));
  const pending = [];
  for (const file of files) {
    try {
      const post = JSON.parse(fs.readFileSync(path.join(BLOG_DIR, file), "utf8"));
      if (post?.title?.ru && post?.excerpt?.ru && Array.isArray(post?.body) && post.body.every((p) => p?.ru)) continue;
      pending.push({ file, post });
    } catch {
      /* битый файл не переводим */
    }
  }
  if (pending.length === 0) {
    console.log("translate-blog: всё переведено");
    return;
  }
  console.log(`translate-blog: к переводу ${pending.length} статей`);
  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const slice = pending.slice(i, i + BATCH);
    const items = slice.map(({ post }) => ({
      slug: post.slug,
      title: post.title?.en || post.title?.de || "",
      excerpt: post.excerpt?.en || post.excerpt?.de || "",
      body: (post.body || []).map((p) => p?.en || p?.de || ""),
    }));
    try {
      const translated = await translate(items);
      for (const item of translated) {
        const target = slice.find((entry) => entry.post.slug === item.slug);
        if (!target) continue;
        const post = target.post;
        post.title = { ...post.title, ru: item.title };
        post.excerpt = { ...post.excerpt, ru: item.excerpt };
        post.body = post.body.map((paragraph, index) => ({
          ...paragraph,
          ru: (item.body && item.body[index]) || item.excerpt,
        }));
        fs.writeFileSync(path.join(BLOG_DIR, target.file), JSON.stringify(post, null, 2) + "\n", "utf8");
        done += 1;
      }
    } catch (error) {
      console.error("translate-blog:", error instanceof Error ? error.message : error);
      break;
    }
  }
  console.log(`translate-blog: переведено ${done} из ${pending.length}`);
}

main().catch((error) => {
  console.error("translate-blog:", error);
  process.exit(1);
});
