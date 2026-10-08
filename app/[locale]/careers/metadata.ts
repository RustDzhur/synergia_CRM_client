// app/[locale]/careers.metadata.ts — SEO страницы вакансий (/careers).
//
// Куда положить: /site/app/[locale]/careers/metadata.ts (новый файл).
// Как подключить: в app/[locale]/careers/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// Вакансии и льготы — из content/footerPages.ts (CAREERS). JobPosting-разметку не добавляем:
// у вакансий в коде есть только название и формат («Remote · Vollzeit»), но нет datePosted,
// зарплаты и идентификатора — такая разметка была бы невалидной.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/careers";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Karriere – offene Stellen bei Firmspace AI",
		description:
			"Remote-first Team, flexible Arbeitszeiten, Weiterbildungsbudget und 30 Tage Urlaub: offene Stellen bei Firmspace AI in Entwicklung, Design und Support.",
		keywords: [
			"Karriere Firmspace AI",
			"Jobs CRM",
			"Remote Jobs",
			"Stellenangebote Software",
			"Frontend Engineer Job",
		],
	},
	en: {
		title: "Careers – open roles at Firmspace AI",
		description:
			"Remote-first team, flexible hours, a learning budget and 30 days of vacation: open roles at Firmspace AI in engineering, design and support.",
		keywords: ["Firmspace AI careers", "CRM jobs", "remote jobs", "software vacancies", "frontend engineer job"],
	},
	ua: {
		title: "Карʼєра – вакансії у Firmspace AI",
		description:
			"Remote-first команда, гнучкий графік, бюджет на навчання та 30 днів відпустки: відкриті вакансії у Firmspace AI.",
		keywords: ["карʼєра Firmspace AI", "вакансії CRM", "віддалена робота", "вакансії в IT", "робота frontend"],
	},
	uz: {
		title: "Karyera – Firmspace AI'dagi bo'sh ish o'rinlari",
		description:
			"Remote-first jamoa, moslashuvchan grafik, o'qish byudjeti va 30 kunlik ta'til: Firmspace AI'da muhandislik, dizayn va qo'llab-quvvatlash bo'yicha ochiq lavozimlar.",
		keywords: ["Firmspace AI karyera", "CRM ishlari", "masofaviy ish", "dasturiy bo'sh ish o'rinlari", "frontend muhandis ishi"],
	},
};

const CRUMB: Record<Locale, string> = { de: "Karriere", en: "Careers", ua: "Карʼєра", uz: "Karyera" };

const POSITIONS: Record<Locale, string[]> = {
	de: ["Senior Frontend Engineer", "Backend Engineer (Node.js)", "Product Designer", "Customer Support Specialist"],
	en: ["Senior Frontend Engineer", "Backend Engineer (Node.js)", "Product Designer", "Customer Support Specialist"],
	ua: ["Senior Frontend-інженер", "Backend-інженер (Node.js)", "Продуктовий дизайнер", "Спеціаліст підтримки клієнтів"],
	uz: ["Katta frontend muhandis", "Backend muhandis (Node.js)", "Mahsulot dizayneri", "Mijozlarni qo'llab-quvvatlash mutaxassisi"],
};

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
			"@type": "WebPage",
			name: SEO[locale].title,
			description: SEO[locale].description,
			url: siteUrl(locale, PATH),
			inLanguage: locale === "ua" ? "uk" : locale,
			// Список вакансий без JobPosting: данных для валидной разметки вакансии в коде нет.
			about: POSITIONS[locale].map((position) => ({ "@type": "Thing", name: position })),
		},
	];
}
