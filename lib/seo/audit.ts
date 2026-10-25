/**
 * SEO-аудит чужого сайта без доступа к коду.
 *
 * Робот открывает публичные страницы (robots.txt → sitemap → обход ссылок),
 * снимает метаданные и собирает отчёт: что мешает странице ранжироваться и
 * что поправить. Ничего не пишет на чужой сайт — это анализ, а не правка.
 *
 * Ограничения осознанные: только GET, только HTML, не больше `limit` страниц,
 * таймаут на запрос, размер 2 МБ. Аудит не «оценивает красоту», он проверяет
 * вещи, которые поисковик действительно читает.
 */

export interface PageAudit {
  readonly url: string;
  readonly status: number;
  readonly title: string;
  readonly titleLength: number;
  readonly description: string;
  readonly descriptionLength: number;
  readonly h1Count: number;
  readonly canonical: string;
  readonly hreflang: readonly string[];
  readonly hasOpenGraph: boolean;
  readonly hasOgImage: boolean;
  readonly structuredData: number;
  readonly imagesWithoutAlt: number;
  /** Адреса картинок без alt — чтобы было видно, какие именно править. */
  readonly imagesWithoutAltSample: readonly string[];
  readonly h1: string;
  /** Типы найденных структурированных данных (Organization, Product, FAQPage…). */
  readonly structuredTypes: readonly string[];
  /** Готовые правки: что заменить и на что. */
  readonly suggestions: readonly string[];
  readonly internalLinks: number;
  readonly htmlLang: string;
  readonly issues: readonly string[];
}

export interface SeoIssue {
  readonly code: string;
  readonly severity: "high" | "medium" | "low";
  readonly title: string;
  readonly count: number;
  readonly pages: readonly string[];
}

export interface SeoAuditResult {
  readonly url: string;
  readonly host: string;
  readonly crawledAt: string;
  readonly score: number;
  readonly pages: readonly PageAudit[];
  readonly issues: readonly SeoIssue[];
  readonly recommendations: readonly string[];
  readonly report: string;
}

const UA = "Mozilla/5.0 (compatible; FirmspaceSeoAudit/1.0; +https://firmspace.de)";
const MAX_BYTES = 2_000_000;

const norm = (value: string): string => value.replace(/\s+/g, " ").trim();
const decode = (value: string): string =>
  norm(
    value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " "),
  );

async function get(url: string): Promise<{ status: number; html: string; finalUrl: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type)) return { status: res.status, html: "", finalUrl: res.url || url };
    const buffer = await res.arrayBuffer();
    const html = new TextDecoder("utf-8").decode(buffer.slice(0, MAX_BYTES));
    return { status: res.status, html, finalUrl: res.url || url };
  } catch {
    return null;
  }
}

/** Адреса для обхода: sitemap (если заявлен), иначе ссылки с главной. */
async function discover(url: URL, limit: number): Promise<string[]> {
  const sameHost = (candidate: URL) => candidate.hostname === url.hostname;
  const found: string[] = [];
  const push = (candidate: string) => {
    try {
      const u = new URL(candidate, url);
      u.hash = "";
      if (!sameHost(u)) return;
      const clean = u.toString();
      if (!found.includes(clean)) found.push(clean);
    } catch {
      /* битый адрес — пропускаем */
    }
  };

  const robots = await get(`${url.origin}/robots.txt`);
  const sitemaps: string[] = [];
  if (robots?.html) {
    for (const line of robots.html.split("\n")) {
      const match = /^\s*sitemap:\s*(\S+)/i.exec(line);
      if (match) sitemaps.push(match[1]);
    }
  }
  if (sitemaps.length === 0) sitemaps.push(`${url.origin}/sitemap.xml`);

  for (const sitemap of sitemaps.slice(0, 3)) {
    const doc = await get(sitemap);
    if (!doc?.html) continue;
    for (const match of Array.from(doc.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi))) push(match[1]);
    if (found.length >= limit) break;
  }

  if (found.length === 0) {
    const home = await get(url.toString());
    if (home?.html) {
      for (const match of Array.from(home.html.matchAll(/<a\s[^>]*href=["']([^"'#]+)/gi))) push(match[1]);
    }
  }
  return found.slice(0, limit);
}

function parsePage(url: string, status: number, html: string): PageAudit {
  const head = html.slice(0, html.indexOf("</head>") + 7 || html.length);
  const titleRaw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? "";
  const title = decode(titleRaw.replace(/<[^>]*>/g, " ")).slice(0, 300);
  const meta = (name: string): string => {
    const pattern = new RegExp(`<meta\\s[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
    return decode(pattern.exec(head)?.[1] ?? "").slice(0, 500);
  };
  const description = meta("description");
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(head)?.[1] ?? "";
  const hreflang = Array.from(new Set(Array.from(head.matchAll(/<link[^>]+hreflang=["']([^"']+)["']/gi)).map((m) => m[1].toLowerCase())));
  const hasOgImage = /<meta[^>]+property=["']og:image["']/i.test(head);
  const hasOpenGraph = /<meta[^>]+property=["']og:/i.test(head);
  const structuredData = (html.match(/application\/ld\+json/gi) ?? []).length;
  const structuredTypes = Array.from(new Set(Array.from(html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)).map((m) => m[1]))).slice(0, 6);
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  const htmlLang = /<html[^>]+lang=["']([^"']+)["']/i.exec(html)?.[1] ?? "";
  const images = Array.from(html.matchAll(/<img\s[^>]*>/gi)).map((m) => m[0]);
  const imagesWithoutAltTags = images.filter((tag) => !/\salt=["'][^"']*["']/i.test(tag));
  const imagesWithoutAlt = imagesWithoutAltTags.length;
  const imagesWithoutAltSample = imagesWithoutAltTags.slice(0, 3).map((tag) => /src=["']([^"']+)["']/i.exec(tag)?.[1] ?? "");
  const h1 = decode((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? "").replace(/<[^>]*>/g, " ")).slice(0, 200);
  let internalLinks = 0;
  try {
    const host = new URL(url).hostname;
    internalLinks = Array.from(html.matchAll(/<a\s[^>]*href=["']([^"'#]+)/gi)).filter((m) => {
      try {
        return new URL(m[1], url).hostname === host;
      } catch {
        return false;
      }
    }).length;
  } catch {
    /* невалидный адрес страницы */
  }

  const issues: string[] = [];
  const titleLength = title.length;
  const descriptionLength = description.length;
  if (!title) issues.push("no-title");
  else if (titleLength < 30) issues.push("title-too-short");
  else if (titleLength > 65) issues.push("title-too-long");
  if (!description) issues.push("no-description");
  else if (descriptionLength < 70) issues.push("description-too-short");
  else if (descriptionLength > 165) issues.push("description-too-long");
  if (!canonical) issues.push("no-canonical");
  if (hreflang.length === 0) issues.push("no-hreflang");
  if (!hasOpenGraph) issues.push("no-open-graph");
  if (!hasOgImage) issues.push("no-og-image");
  if (structuredData === 0) issues.push("no-structured-data");
  if (h1Count !== 1) issues.push("h1-count");
  if (imagesWithoutAlt > 0) issues.push("images-without-alt");
  if (!htmlLang) issues.push("no-lang");
  if (status >= 400) issues.push("http-error");

  const suggestions: string[] = [];
  const clip = (text: string, max: number) => {
    const words = text.split(/\s+/);
    let out = "";
    for (const word of words) {
      if ((out + " " + word).trim().length > max) break;
      out = (out + " " + word).trim();
    }
    return out || text.slice(0, max);
  };
  if (titleLength > 65) suggestions.push(`title сократить до ~60 символов, например: «${clip(title, 58)}»`);
  if (!title) suggestions.push("добавить title: польза страницы для клиента + бренд, до 60 символов");
  if (!description) suggestions.push("добавить description на 120–160 символов: что человек получит на странице");
  else if (descriptionLength > 165) suggestions.push(`description сократить до ~155 символов, например: «${clip(description, 152)}»`);
  else if (descriptionLength < 70) suggestions.push(`description расширить до 120–160 символов (сейчас ${descriptionLength})`);
  if (!canonical) suggestions.push(`добавить <link rel="canonical" href="${url}">`);
  if (hreflang.length === 0) suggestions.push("если есть языковые версии — связать их hreflang (de/en/ru + x-default)");
  if (!hasOgImage) suggestions.push("добавить og:image 1200×630 (cначала нарисовать/выбрать картинку страницы)");
  if (!hasOpenGraph) suggestions.push("добавить og:title, og:description, og:image");
  if (structuredData === 0) suggestions.push("добавить JSON-LD: Organization на главной, Service/Product на страницах услуг, BlogPosting у статей");
  if (h1Count === 0) suggestions.push("добавить один h1 с главной мыслью страницы");
  if (h1Count > 1) suggestions.push(`оставить один h1 (сейчас ${h1Count})`);
  if (imagesWithoutAlt > 0) suggestions.push(`добавить alt к ${imagesWithoutAlt} картинкам${imagesWithoutAltSample.length ? ` (например: ${imagesWithoutAltSample.join(", ")})` : ""}`);
  if (!htmlLang) suggestions.push('указать язык страницы: <html lang="de">');

  return {
    url,
    status,
    title,
    titleLength,
    description,
    descriptionLength,
    h1Count,
    canonical,
    hreflang,
    hasOpenGraph,
    hasOgImage,
    structuredData,
    imagesWithoutAlt,
    imagesWithoutAltSample,
    h1,
    structuredTypes,
    suggestions,
    internalLinks,
    htmlLang,
    issues,
  };
}

const ISSUE_META: Record<string, { severity: "high" | "medium" | "low"; title: string; advice: string }> = {
  "no-title": { severity: "high", title: "Страница без title", advice: "Добавьте уникальный title (30–60 символов) с главной мыслью страницы." },
  "title-too-short": { severity: "medium", title: "Слишком короткий title", advice: "Расширьте title до 30–60 символов — место в выдаче используется не полностью." },
  "title-too-long": { severity: "low", title: "Слишком длинный title", advice: "Сократите title до ~60 символов, иначе поисковик обрежет его." },
  "no-description": { severity: "high", title: "Нет meta description", advice: "Добавьте description (120–160 символов): это текст сниппета в выдаче." },
  "description-too-short": { severity: "medium", title: "Короткий description", advice: "Доведите description до ~150 символов, чтобы использовать место в сниппете." },
  "description-too-long": { severity: "low", title: "Слишком длинный description", advice: "Сократите description до ~160 символов." },
  "no-canonical": { severity: "medium", title: "Нет canonical", advice: "Добавьте canonical на самодостаточный адрес страницы — иначе возможны дубли." },
  "no-hreflang": { severity: "low", title: "Нет языковых версий (hreflang)", advice: "Если страница есть на нескольких языках — добавьте hreflang-связи между версиями." },
  "no-open-graph": { severity: "low", title: "Нет Open Graph", advice: "Добавьте og:title/og:description/og:image — так ссылка выглядит в соцсетях." },
  "no-og-image": { severity: "low", title: "Нет og:image", advice: "Добавьте картинку 1200×630 в og:image." },
  "no-structured-data": { severity: "medium", title: "Нет структурированных данных", advice: "Добавьте JSON-LD (Organization/Service/Article/FAQPage) — это расширяет сниппет." },
  "h1-count": { severity: "medium", title: "Проблема с h1", advice: "На странице должен быть ровно один h1, остальные заголовки — h2/h3." },
  "images-without-alt": { severity: "medium", title: "Картинки без alt", advice: "Добавьте alt к изображениям: это и доступность, и понимание картинки поиском." },
  "no-lang": { severity: "low", title: "Не указан язык страницы", advice: "Укажите lang у <html> (например, lang=\"de\")." },
  "http-error": { severity: "high", title: "Страница отвечает ошибкой", advice: "Проверьте статус страницы: 4xx/5xx из индекса выпадают." },
};

export async function auditSite(input: string, options: { limit?: number } = {}): Promise<SeoAuditResult> {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 25);
  const target = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  const url = new URL(target.toString());
  url.hash = "";

  const discovered = await discover(url, limit);
  const urls = discovered.length > 0 ? discovered : [url.toString()];
  const pages: PageAudit[] = [];
  for (const pageUrl of urls.slice(0, limit)) {
    const doc = await get(pageUrl);
    if (!doc) {
      pages.push(parsePage(pageUrl, 0, ""));
      continue;
    }
    pages.push(parsePage(pageUrl, doc.status, doc.html));
  }

  const aggregated = new Map<string, string[]>();
  for (const page of pages) {
    for (const code of page.issues) {
      const list = aggregated.get(code) ?? [];
      list.push(page.url);
      aggregated.set(code, list);
    }
  }
  const issues: SeoIssue[] = Array.from(aggregated.entries())
    .map(([code, urlsWithIssue]) => ({
      code,
      severity: ISSUE_META[code]?.severity ?? "medium",
      title: ISSUE_META[code]?.title ?? code,
      count: urlsWithIssue.length,
      pages: urlsWithIssue.slice(0, 5),
    }))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity] || b.count - a.count));

  const penalty = issues.reduce((sum, issue) => sum + ({ high: 6, medium: 3, low: 1 }[issue.severity] ?? 2) * Math.min(issue.count, 4), 0);
  const score = Math.max(0, Math.min(100, 100 - Math.round(penalty / Math.max(pages.length, 1) * 2)));
  const recommendations = issues
    .map((issue) => ISSUE_META[issue.code]?.advice)
    .filter((value): value is string => Boolean(value))
    .slice(0, 8);

  const title = `SEO-Audit ${url.hostname}`;
  const lines: string[] = [
    `${title} — ${pages.length} страниц, оценка ${score}/100`,
    "",
    `Проверено: ${pages.map((page) => page.url).slice(0, 6).join(", ")}${pages.length > 6 ? " …" : ""}`,
    "",
    "Проблемы:",
  ];
  for (const issue of issues.length ? issues : [{ code: "-", title: "Проблем не найдено", severity: "low" as const, count: 0, pages: [] }]) {
    lines.push(`• ${issue.title}${issue.count ? ` — ${issue.count} стр.` : ""}`);
  }
  if (recommendations.length) {
    lines.push("", "Что исправить в первую очередь:");
    for (const advice of recommendations) lines.push(`— ${advice}`);
  }
  lines.push("", "Постранично (что именно написано сейчас и что исправить):");
  for (const page of pages.slice(0, 12)) {
    lines.push("", `■ ${page.url}  (HTTP ${page.status || "нет ответа"})`);
    lines.push(`   title: ${page.title ? `«${page.title}» (${page.titleLength} симв.)` : "нет"}`);
    lines.push(`   description: ${page.description ? `«${page.description}» (${page.descriptionLength} симв.)` : "нет"}`);
    lines.push(`   h1: ${page.h1 ? `«${page.h1}»` : "нет"}${page.h1Count > 1 ? ` (h1 на странице: ${page.h1Count})` : ""}`);
    lines.push(`   canonical: ${page.canonical || "нет"} · hreflang: ${page.hreflang.length ? page.hreflang.join("/") : "нет"}`);
    lines.push(`   структурированные данные: ${page.structuredData ? `${page.structuredData} блок(ов)${page.structuredTypes.length ? ` (${page.structuredTypes.join(", ")})` : ""}` : "нет"} · og:image: ${page.hasOgImage ? "есть" : "нет"}`);
    if (page.imagesWithoutAlt) lines.push(`   картинки без alt: ${page.imagesWithoutAlt}${page.imagesWithoutAltSample.length ? ` — ${page.imagesWithoutAltSample.join(", ")}` : ""}`);
    if (page.suggestions.length) {
      lines.push("   что исправить:");
      for (const suggestion of page.suggestions) lines.push(`     — ${suggestion}`);
    } else {
      lines.push("   проблем по техническим критериям нет");
    }
  }
  lines.push("", "Как читать отчёт: проверяются публичные страницы и их HTML. Файл и номер строки можно указать только при доступе к коду сайта — для этого нужен инженерный агент с репозиторием; здесь указаны точный URL, элемент и текущий текст, который надо заменить.");

  return {
    url: url.toString(),
    host: url.hostname,
    crawledAt: new Date().toISOString(),
    score,
    pages,
    issues,
    recommendations,
    report: lines.join("\n"),
  };
}
