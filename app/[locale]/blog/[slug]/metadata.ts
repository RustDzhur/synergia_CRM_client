// app/[locale]/blog/[slug]/metadata.ts — динамические SEO-метаданные статьи блога (/blog/<slug>).
//
// Данные берутся из той же таблицы, что и app/sitemap.ts и app/api/blog (BlogPost: title/excerpt — Json
// с ключами de/en/ua), теперь на сервере во время запроса. Если статья не найдена, не опубликована
// или БД недоступна — отдаём noindex, чтобы в индексе не появлялись пустые и битые адреса.
//
// JSON-LD BlogPosting (headline, datePublished, image, inLanguage) собирается в pageJsonLd и
// рендерится серверной страницей: <JsonLd data={pageJsonLd(post, locale)} />.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, blogPostingLd, pageMetadata, truncate, type Locale } from "@/lib/seo";
import { blogText, type BlogPostDTO } from "@/lib/blog";
import { getPublishedPost } from "@/lib/blogPosts";

export const PATH_PREFIX = "/blog";

const FALLBACK: Record<Locale, { title: string; description: string }> = {
	de: { title: "Beitrag – Firmspace AI", description: "Beitrag im Blog von Firmspace AI." },
	en: { title: "Article – Firmspace AI", description: "An article in the Firmspace AI blog." },
	ua: { title: "Стаття – Firmspace AI", description: "Стаття в блозі Firmspace AI." },
};

const KEYWORDS: Record<Locale, string[]> = {
	de: ["Firmspace Blog", "CRM", "KI-Automatisierung", "Kundenarbeit"],
	en: ["Firmspace blog", "CRM", "AI automation", "customer work"],
	ua: ["блог Firmspace", "CRM", "ШІ-автоматизація", "робота з клієнтами"],
};

/** Заголовок статьи для <h1> и breadcrumb: текст из БД для нужной локали, иначе запасной. */
export function postHeading(post: BlogPostDTO, localeCode: string): string {
	const locale = asLocale(localeCode);
	return blogText(post.title, locale) || FALLBACK[locale].title;
}

// Заголовок из БД → title страницы: короткие дополняем названием продукта, длинные обрезаем до 60 символов.
function titleFor(post: BlogPostDTO, locale: Locale): string {
	const raw = postHeading(post, locale);
	return raw.length <= 44 ? `${raw} – Firmspace AI` : truncate(raw, 60);
}

function descriptionFor(post: BlogPostDTO, locale: Locale): string {
	return truncate(blogText(post.excerpt, locale) || FALLBACK[locale].description, 158);
}

export async function generateMetadata({
	params,
}: {
	params: { locale: string; slug: string };
}): Promise<Metadata> {
	const locale = asLocale(params.locale);
	const path = `${PATH_PREFIX}/${params.slug}`;
	const post = await getPublishedPost(params.slug).catch(() => null);

	if (!post) {
		return pageMetadata({
			path,
			locale,
			...FALLBACK[locale],
			keywords: KEYWORDS[locale],
			robots: { index: false, follow: true },
			noCanonical: true,
		});
	}

	return pageMetadata({
		path: `${PATH_PREFIX}/${post.slug}`,
		locale,
		title: titleFor(post, locale),
		description: descriptionFor(post, locale),
		keywords: KEYWORDS[locale],
		ogType: "article",
		publishedTime: new Date(post.publishedAt).toISOString(),
	});
}

export function pageJsonLd(post: BlogPostDTO, localeCode: string) {
	const locale = asLocale(localeCode);
	const title = postHeading(post, locale);
	return [
		breadcrumbLd(locale, [
			{ name: "Firmspace AI", path: "/" },
			{ name: "Blog", path: PATH_PREFIX },
			{ name: title, path: `${PATH_PREFIX}/${post.slug}` },
		]),
		blogPostingLd(locale, {
			slug: post.slug,
			title,
			description: descriptionFor(post, locale),
			publishedAt: new Date(post.publishedAt).toISOString(),
			image: post.image,
		}),
	];
}
