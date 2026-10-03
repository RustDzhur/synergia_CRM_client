// app/[locale]/blog/[slug].metadata.ts — SEO отдельной статьи блога (/blog/<slug>).
//
// Куда положить: /site/app/[locale]/blog/[slug]/metadata.ts (новый файл).
// Как подключить: в app/[locale]/blog/[slug]/page.tsx добавить
//
//   export { generateMetadata } from "./metadata";
//
// Данные берутся из той же таблицы, что и в app/sitemap.ts (BlogPost: title/excerpt — Json
// с ключами de/en/ua). Если статья не найдена или БД недоступна — отдаём noindex, чтобы
// в индексе не появлялись пустые/битые адреса.
//
// JSON-LD BlogPosting здесь не подключён: страница статьи — клиентский компонент,
// который получает текст только через fetch в браузере. Чтобы отдать разметку,
// страницу нужно сделать серверной и передать статью в BlogPost пропсом
// (см. PATCHES.md, шаг «blog/[slug] — опционально»).

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, blogPostingLd, pageMetadata, truncate, type Locale } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const PATH_PREFIX = "/blog";

export interface BlogPostSeo {
	slug: string;
	title: unknown;
	excerpt: unknown;
	publishedAt: Date;
	updatedAt: Date;
}

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

function pick(value: unknown, locale: Locale): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	const raw = record[locale] ?? record.en ?? record.de ?? record.ua;
	return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export async function loadPost(slug: string): Promise<BlogPostSeo | null> {
	try {
		const post = await prisma.blogPost.findFirst({
			where: { slug, published: true },
			select: { slug: true, title: true, excerpt: true, publishedAt: true, updatedAt: true },
		});
		return (post as BlogPostSeo | null) ?? null;
	} catch {
		return null;
	}
}

export async function generateMetadata({
	params,
}: {
	params: { locale: string; slug: string };
}): Promise<Metadata> {
	const locale = asLocale(params.locale);
	const path = `${PATH_PREFIX}/${params.slug}`;
	const post = await loadPost(params.slug);

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

	const rawTitle = pick(post.title, locale) ?? FALLBACK[locale].title;
	// Название статьи приходит из админки и может быть длинным: держим title в пределах 60 символов.
	const title = rawTitle.length <= 44 ? `${rawTitle} – Firmspace AI` : truncate(rawTitle, 60);
	const description = truncate(pick(post.excerpt, locale) ?? FALLBACK[locale].description, 158);

	return pageMetadata({
		path: `${PATH_PREFIX}/${post.slug}`,
		locale,
		title,
		description,
		keywords: KEYWORDS[locale],
		ogType: "article",
		publishedTime: post.publishedAt.toISOString(),
		modifiedTime: post.updatedAt.toISOString(),
	});
}

export function pageJsonLd(post: BlogPostSeo, localeCode: string) {
	const locale = asLocale(localeCode);
	const title = pick(post.title, locale) ?? FALLBACK[locale].title;
	const description = truncate(pick(post.excerpt, locale) ?? FALLBACK[locale].description, 158);
	return [
		breadcrumbLd(locale, [
			{ name: "Firmspace AI", path: "/" },
			{ name: "Blog", path: PATH_PREFIX },
			{ name: title, path: `${PATH_PREFIX}/${post.slug}` },
		]),
		blogPostingLd(locale, {
			slug: post.slug,
			title,
			description,
			publishedAt: post.publishedAt.toISOString(),
			updatedAt: post.updatedAt.toISOString(),
		}),
	];
}
