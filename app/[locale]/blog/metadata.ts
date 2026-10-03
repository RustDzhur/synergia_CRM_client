// app/[locale]/blog.metadata.ts — SEO страницы блога (/blog).
//
// Куда положить: /site/app/[locale]/blog/metadata.ts (новый файл).
// Как подключить: в app/[locale]/blog/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Blog({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// ВАЖНО (SEO-находка): сама страница блога — клиентский компонент, который тянет статьи
// через fetch("/api/blog") в useEffect. В HTML при первой отдаче статей нет, поэтому для
// поисковика это пустая страница. См. REPORT.md, раздел «Находки»: список статей стоит
// рендерить на сервере (prisma прямо в page.tsx) и передавать в BlogPage готовым.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/blog";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Blog: CRM, KI und Automatisierung",
		description:
			"Artikel über CRM, KI-Automatisierung und die Arbeit mit Kunden – Hinweise und Praxis aus der Entwicklung von Firmspace AI.",
		keywords: ["CRM Blog", "KI Automatisierung", "CRM Praxis", "Vertrieb Tipps", "Kundenkommunikation"],
	},
	en: {
		title: "Blog: CRM, AI and automation",
		description:
			"Articles about CRM, AI automation and working with customers — notes and practice from building Firmspace AI.",
		keywords: ["CRM blog", "AI automation", "CRM practice", "sales tips", "customer communication"],
	},
	ua: {
		title: "Блог: CRM, ШІ та автоматизація",
		description:
			"Статті про CRM, ШІ-автоматизацію та роботу з клієнтами — нотатки й практика з розробки Firmspace AI.",
		keywords: ["блог CRM", "ШІ автоматизація", "практика CRM", "поради з продажів", "комунікація з клієнтами"],
	},
};

const CRUMB: Record<Locale, string> = { de: "Blog", en: "Blog", ua: "Блог" };

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return pageMetadata({ path: PATH, locale, ...SEO[locale] });
}

export function pageJsonLd(localeCode: string) {
	const locale = asLocale(localeCode);
	return [
		breadcrumbLd(locale, [
			{ name: "Firmspace AI", path: "/" },
			{ name: CRUMB[locale], path: PATH },
		]),
		{
			"@context": "https://schema.org",
			"@type": "Blog",
			name: SEO[locale].title,
			description: SEO[locale].description,
			url: siteUrl(locale, PATH),
			inLanguage: locale === "ua" ? "uk" : locale,
			publisher: { "@type": "Organization", name: "Firmspace AI", url: siteUrl(locale, "/") },
		},
	];
}
