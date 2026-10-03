// app/[locale]/blog/metadata.ts — SEO страницы блога (/blog).
//
// Метаданные списка не зависят от статей: они заданы на каждом языке ниже. Сами статьи
// страница берёт из БД на сервере (lib/blogPosts.ts) и рендерит в HTML — см. app/[locale]/blog/page.tsx.

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
