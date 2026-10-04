// app/sitemap.ts — карта сайта (базовый вариант, без hreflang-разметки внутри XML).
//
// Куда положить: заменить /site/app/sitemap.ts целиком.
//
// Что изменилось против текущей версии:
//   1) домен по умолчанию — https://firmspace.de (APP_URL), а не www;
//   2) у каждой страницы появились changeFrequency, priority и lastModified
//      (MetadataRoute.Sitemap этой версии Next умеет ровно эти поля — см. REPORT.md);
//   3) /features и /contacts остались, ничего не потеряно; noindex-страницы
//      (/crm, /pay/done, /c/<token>) в карту не добавляются;
//   4) статьи блога берут updatedAt, а не publishedAt: карта отражает правки.
//
// ВАЖНО: hreflang (xhtml:link) в MetadataRoute.Sitemap этой версии Next НЕ поддерживается —
// сериализатор пишет только loc/lastmod/changefreq/priority. Если hreflang в sitemap обязателен,
// используйте вариант output/app/sitemap.xml/route.ts вместо этого файла (два файла одновременно
// держать нельзя — будет конфликт маршрута /sitemap.xml).

import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

const SITE = (process.env.APP_URL ?? "https://firmspace.de").replace(/\/+$/, "");
const DEFAULT_LOCALE = "de";
// de — язык по умолчанию и работает без префикса; en и ua — с префиксом.
const LOCALES = ["de", "en", "ua"] as const;

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface PageDef {
	path: string;
	changeFrequency: ChangeFrequency;
	priority: number;
}

// Порядок и приоритеты: главная → продающие страницы → справка → юридические.
const PAGES: PageDef[] = [
	{ path: "", changeFrequency: "weekly", priority: 1 },
	{ path: "/features", changeFrequency: "monthly", priority: 0.9 },
	{ path: "/services", changeFrequency: "monthly", priority: 0.9 },
	{ path: "/about", changeFrequency: "monthly", priority: 0.7 },
	{ path: "/contacts", changeFrequency: "yearly", priority: 0.7 },
	{ path: "/documentation", changeFrequency: "weekly", priority: 0.7 },
	{ path: "/support", changeFrequency: "monthly", priority: 0.6 },
	{ path: "/blog", changeFrequency: "weekly", priority: 0.6 },
	{ path: "/careers", changeFrequency: "monthly", priority: 0.5 },
	{ path: "/team", changeFrequency: "yearly", priority: 0.4 },
	{ path: "/referral", changeFrequency: "yearly", priority: 0.4 },
	{ path: "/privacypolicy", changeFrequency: "yearly", priority: 0.3 },
	{ path: "/agb", changeFrequency: "yearly", priority: 0.3 },
	{ path: "/impressum", changeFrequency: "yearly", priority: 0.3 },
];

// Дата последнего содержательного обзора текстов страниц. Обновлять вручную вместе с правками.
const LAST_REVIEW = new Date("2026-10-03T00:00:00.000Z");

const prefixOf = (locale: string) => (locale === DEFAULT_LOCALE ? "" : `/${locale}`);

// Статьи блога, лежащие в репозитории статическими страницами (app/[locale]/blog/<slug>),
// а не в таблице BlogPost. Карта сайта строится по БД, поэтому такие адреса перечисляем здесь.
// Если статья переехала в БД, строку убираем — дубли отсекаются по slug в sitemap() ниже.
const FILE_POSTS: { slug: string; publishedAt: string }[] = [
	{ slug: "2026-10-04-ai-v-biznes-processah", publishedAt: "2026-10-04" },
	{ slug: "2026-10-04-ai-klienty-24-7", publishedAt: "2026-10-04" },
	{ slug: "2026-10-04-ai-action-v-avtomatizacii", publishedAt: "2026-10-04" },
	{ slug: "2026-10-04-ai-scheta-i-napominaniya", publishedAt: "2026-10-04" },
];

const filePostEntries = (posts: { slug: string; publishedAt: string }[]): MetadataRoute.Sitemap =>
	posts.flatMap((post) =>
		LOCALES.map((locale) => ({
			url: `${SITE}${prefixOf(locale)}/blog/${post.slug}`,
			lastModified: new Date(`${post.publishedAt}T00:00:00.000Z`),
			changeFrequency: "monthly" as const,
			priority: 0.5,
		}))
	);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const staticEntries: MetadataRoute.Sitemap = PAGES.flatMap((page) =>
		LOCALES.map((locale) => ({
			url: `${SITE}${prefixOf(locale)}${page.path}` || SITE,
			lastModified: LAST_REVIEW,
			changeFrequency: page.changeFrequency,
			priority: page.priority,
		}))
	);

	try {
		const posts = await prisma.blogPost.findMany({
			where: { published: true },
			select: { slug: true, publishedAt: true, updatedAt: true },
		});
		const postEntries: MetadataRoute.Sitemap = posts.flatMap((post: { slug: string; publishedAt: Date; updatedAt: Date }) =>
			LOCALES.map((locale) => ({
				url: `${SITE}${prefixOf(locale)}/blog/${post.slug}`,
				lastModified: post.updatedAt ?? post.publishedAt,
				changeFrequency: "monthly" as const,
				priority: 0.5,
			}))
		);
		const inDb = new Set(posts.map((post: { slug: string }) => post.slug));
		return [...staticEntries, ...postEntries, ...filePostEntries(FILE_POSTS.filter((post) => !inDb.has(post.slug)))];
	} catch {
		// БД недоступна — отдаём хотя бы статические страницы, как и раньше.
		return [...staticEntries, ...filePostEntries(FILE_POSTS)];
	}
}
