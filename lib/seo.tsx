// lib/seo.tsx — единый SEO-помощник сайта Firmspace AI.
//
// Куда положить: /site/lib/seo.tsx (новый файл).
// Зачем: все страницы получают одинаковые canonical / hreflang / openGraph / twitter
// и не дублируют одну и ту же логику. Значения домена берутся из APP_URL — того же
// источника, что и в app/robots.ts и app/sitemap.ts.
//
// Важно про язык по умолчанию: middleware (next-intl, localePrefix по умолчанию "as-needed")
// отдаёт немецкий (de) БЕЗ префикса, а en/ua — с префиксом. Поэтому canonical главной по-немецки —
// https://firmspace.de/ , а не /de/ ; /de/... middleware перенаправляет на /...
// Именно так уже устроен app/sitemap.ts (см. PREFIXES = ["", "/en", "/ua"]).

import type { Metadata } from "next";
import { createElement } from "react";

// ── Домен и языки ─────────────────────────────────────────────────────────────

export const SITE_URL = (process.env.APP_URL ?? "https://firmspace.de").replace(/\/+$/, "");
export const SITE_NAME = "Firmspace AI";
export const DEFAULT_LOCALE = "de" as const;
export const LOCALES = ["de", "en", "ua"] as const;
export type Locale = (typeof LOCALES)[number];

// Код языка сайта (ua) ≠ код hreflang (uk). Это же соответствие использует <html lang> в layout.
export const HREFLANG: Record<Locale, string> = { de: "de", en: "en", ua: "uk" };
export const OG_LOCALE: Record<Locale, string> = { de: "de_DE", en: "en_GB", ua: "uk_UA" };

// Картинка для openGraph/twitter. В /public сейчас нет отдельного баннера 1200×630,
// поэтому используется существующий растровый файл (512×512).
// TODO: заменить на /images/og-firmspace.png (1200×630) и обновить только эту строку.
export const OG_IMAGE = "/iris-avatar.png";

// ── Контакты ─────────────────────────────────────────────────────────────────
// ВНИМАНИЕ: значения взяты из content/sitePages.ts (CONTACT.details). Домен .example —
// зарезервированный для документации, то есть это демо-данные, а Impressum в коде —
// шаблон с [заглушками]. Перед публикацией ContactPoint в JSON-LD замените их на боевые.
export const CONTACT = {
	email: "hello@firmspace.example",
	phone: "+49 30 1234 5678",
	street: "Friedrichstraße 100",
	postalCode: "10117",
	city: "Berlin",
	country: "DE",
};

// ── Утилиты ──────────────────────────────────────────────────────────────────

export function asLocale(value?: string): Locale {
	// у узбекской версии пока нет своих SEO-текстов: заголовки и описания берутся английские
	if (value === "uz") return "en";
	return value === "en" || value === "ua" ? value : "de";
}

function cleanPath(path: string): string {
	if (!path || path === "/") return "";
	const withSlash = path.startsWith("/") ? path : `/${path}`;
	return withSlash.replace(/\/+$/, "");
}

/** Путь без домена: sitePath("de", "/about") -> "/about", sitePath("en", "/") -> "/en". */
export function sitePath(locale: Locale, path = "/"): string {
	const clean = cleanPath(path);
	const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
	return `${prefix}${clean}`;
}

/** Абсолютный адрес: siteUrl("ua", "/about") -> "https://firmspace.de/ua/about". */
export function siteUrl(locale: Locale, path = "/"): string {
	const pathname = sitePath(locale, path);
	return pathname ? `${SITE_URL}${pathname}` : SITE_URL;
}

/** hreflang для metadata.alternates.languages (uk/en/de + x-default). */
export function languageAlternates(path = "/"): Record<string, string> {
	const languages: Record<string, string> = {};
	for (const locale of LOCALES) languages[HREFLANG[locale]] = siteUrl(locale, path);
	languages["x-default"] = siteUrl(DEFAULT_LOCALE, path);
	return languages;
}

/** Обрезает строку до лимита по границе слова (для title из БД блога). */
export function truncate(value: string, limit: number): string {
	const text = value.trim();
	if (text.length <= limit) return text;
	const cut = text.slice(0, limit - 1);
	const space = cut.lastIndexOf(" ");
	return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const DEFAULT_ROBOTS: Metadata["robots"] = {
	index: true,
	follow: true,
	googleBot: {
		index: true,
		follow: true,
		"max-image-preview": "large",
		"max-snippet": -1,
		"max-video-preview": -1,
	},
};

export const NO_INDEX_ROBOTS: Metadata["robots"] = {
	index: false,
	follow: false,
	nocache: true,
	googleBot: { index: false, follow: false, noimageindex: true },
};

// ── Конструктор метаданных страницы ──────────────────────────────────────────

export interface PageMetaInput {
	/** Путь внутри локали, всегда с ведущим слэшем: "/about", "/blog/my-post", "/" для главной. */
	path?: string;
	locale: Locale;
	/** Готовый title целиком (до 60 символов), уже с названием продукта. */
	title: string;
	/** Description (155–160 символов максимум). */
	description: string;
	keywords: string[];
	ogType?: "website" | "article" | "profile";
	images?: string[];
	publishedTime?: string;
	modifiedTime?: string;
	robots?: Metadata["robots"];
	/** true — не выводить canonical (для страниц с robots noindex). */
	noCanonical?: boolean;
}

export function pageMetadata(input: PageMetaInput): Metadata {
	const path = input.path ?? "/";
	const url = siteUrl(input.locale, path);
	const languages = languageAlternates(path);
	const images = input.images ?? [OG_IMAGE];

	const openGraph = {
		type: input.ogType ?? "website",
		title: input.title,
		description: input.description,
		url,
		siteName: SITE_NAME,
		locale: OG_LOCALE[input.locale],
		alternateLocale: LOCALES.filter((locale) => locale !== input.locale).map((locale) => OG_LOCALE[locale]),
		images,
		...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
		...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
	};

	return {
		title: input.title,
		description: input.description,
		keywords: input.keywords,
		alternates: input.noCanonical ? { languages } : { canonical: url, languages },
		openGraph: openGraph as Metadata["openGraph"],
		twitter: {
			card: "summary_large_image",
			title: input.title,
			description: input.description,
			images,
		},
		robots: input.robots ?? DEFAULT_ROBOTS,
	};
}

// ── JSON-LD (schema.org) ─────────────────────────────────────────────────────

export interface Crumb {
	name: string;
	path: string;
}

export function breadcrumbLd(locale: Locale, crumbs: Crumb[]) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: crumbs.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: siteUrl(locale, crumb.path),
		})),
	};
}

export function contactPointLd() {
	return {
		"@type": "ContactPoint",
		contactType: "customer support",
		email: CONTACT.email,
		telephone: CONTACT.phone,
		availableLanguage: ["de", "en", "uk"],
		areaServed: "DE",
	};
}

export function organizationLd(options: { withContactPoint?: boolean; description?: string } = {}) {
	const organization: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: SITE_NAME,
		url: SITE_URL,
		logo: `${SITE_URL}/icon.svg`,
		description:
			options.description ??
			"Firmspace AI — CRM, Team-Kommunikation, Projekte und Buchhaltung in einer Plattform.",
	};
	if (options.withContactPoint) organization.contactPoint = [contactPointLd()];
	return organization;
}

export function websiteLd(locale: Locale) {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: SITE_NAME,
		url: siteUrl(locale, "/"),
		inLanguage: HREFLANG[locale],
		publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
	};
}

export interface SoftwareLdCopy {
	description: string;
	features: string[];
}

// Цены — из config/plans.ts (0 / 20 / 53 € в месяц), годовой платёж = 10 месяцев.
export function softwareApplicationLd(locale: Locale, copy: SoftwareLdCopy) {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: SITE_NAME,
		applicationCategory: "BusinessApplication",
		applicationSubCategory: "CRM",
		operatingSystem: "Web browser",
		url: siteUrl(locale, "/"),
		description: copy.description,
		inLanguage: HREFLANG[locale],
		featureList: copy.features,
		offers: [
			{ "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR", url: siteUrl(locale, "/") },
			{ "@type": "Offer", name: "Standard", price: "20", priceCurrency: "EUR", url: siteUrl(locale, "/") },
			{ "@type": "Offer", name: "Professional", price: "53", priceCurrency: "EUR", url: siteUrl(locale, "/") },
		],
	};
}

export function serviceCatalogLd(locale: Locale, services: { name: string; description: string }[]) {
	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		itemListElement: services.map((service, index) => ({
			"@type": "ListItem",
			position: index + 1,
			item: {
				"@type": "Service",
				name: service.name,
				description: service.description,
				url: siteUrl(locale, "/services"),
				provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
				areaServed: "DE",
			},
		})),
	};
}

export function faqPageLd(items: { q: string; a: string }[]) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.q,
			acceptedAnswer: { "@type": "Answer", text: item.a },
		})),
	};
}

export function blogPostingLd(
	locale: Locale,
	post: { slug: string; title: string; description: string; publishedAt?: string; updatedAt?: string; image?: string }
) {
	const url = siteUrl(locale, `/blog/${post.slug}`);
	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: post.title,
		description: post.description,
		url,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		inLanguage: HREFLANG[locale],
		datePublished: post.publishedAt,
		dateModified: post.updatedAt ?? post.publishedAt,
		image: post.image ? [post.image.startsWith("http") ? post.image : `${SITE_URL}${post.image}`] : undefined,
		publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
	};
}

// ── Рендер JSON-LD ───────────────────────────────────────────────────────────
// <JsonLd data={pageJsonLd(params.locale)} /> внутри серверного page.tsx.
// createElement вместо JSX, чтобы файл можно было держать в .tsx без разметки.

export function JsonLd({ data }: { data: unknown }) {
	return createElement("script", {
		type: "application/ld+json",
		dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") },
	});
}
