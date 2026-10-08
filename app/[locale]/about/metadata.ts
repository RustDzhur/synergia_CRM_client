// app/[locale]/about.metadata.ts — SEO страницы «О нас» (/about).
//
// Куда положить: /site/app/[locale]/about/metadata.ts (новый файл).
// Как подключить: в app/[locale]/about/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function About({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/about";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Über uns – Firmspace AI",
		description:
			"Firmspace AI bringt Kundenbeziehungen, Teamarbeit, Projekte und Buchhaltung in ein Kabinett – gebaut für kleine und mittlere Betriebe.",
		keywords: [
			"über Firmspace AI",
			"CRM für KMU",
			"CRM Anbieter",
			"Kundenbeziehungen",
			"Teamarbeit Software",
			"Buchhaltung",
			"Datenschutz CRM",
		],
	},
	en: {
		title: "About us – Firmspace AI",
		description:
			"Firmspace AI brings customer relationships, teamwork, projects and accounting into one cabinet — built for small and mid-sized companies.",
		keywords: [
			"about Firmspace AI",
			"CRM for SMB",
			"CRM vendor",
			"customer relationships",
			"teamwork software",
			"accounting",
			"data protection",
		],
	},
	ua: {
		title: "Про нас – Firmspace AI",
		description:
			"Firmspace AI збирає роботу з клієнтами, командну роботу, проєкти й бухгалтерію в одному кабінеті — для малого та середнього бізнесу.",
		keywords: [
			"про Firmspace AI",
			"CRM для малого бізнесу",
			"постачальник CRM",
			"взаємини з клієнтами",
			"командна робота",
			"бухгалтерія",
			"захист даних",
		],
	},
	uz: {
		title: "Biz haqimizda – Firmspace AI",
		description:
			"Firmspace AI mijozlar bilan ishlash, jamoa ishi, loyihalar va buxgalteriyani bitta kabinetga yig'adi — kichik va o'rta biznes uchun.",
		keywords: [
			"Firmspace AI haqida",
			"kichik biznes uchun CRM",
			"CRM yetkazib beruvchi",
			"mijozlar bilan munosabatlar",
			"jamoa ishi dasturi",
			"buxgalteriya",
			"ma'lumotlarni himoya qilish",
		],
	},
};

const CRUMB: Record<Locale, string> = { de: "Über uns", en: "About us", ua: "Про нас", uz: "Biz haqimizda" };

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
			"@type": "AboutPage",
			name: SEO[locale].title,
			description: SEO[locale].description,
			url: siteUrl(locale, PATH),
			inLanguage: locale === "ua" ? "uk" : locale,
		},
	];
}
