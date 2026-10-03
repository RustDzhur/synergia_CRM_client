// app/[locale]/documentation.metadata.ts — SEO страницы документации (/documentation).
//
// Куда положить: /site/app/[locale]/documentation/metadata.ts (новый файл).
// Как подключить: в app/[locale]/documentation/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   // страница уже принимает params — добавить <JsonLd data={pageJsonLd(params.locale)} /> в JSX
//
// Разделы документации берутся из content/docs/index.ts (DOC_SECTIONS).

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/documentation";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Dokumentation – Firmspace AI",
		description:
			"Schritt-für-Schritt-Anleitungen zu jedem Bereich von Firmspace AI: Registrierung, CRM, Aufgaben, Finanzen, Automatisierung, KI-Assistent und mehr.",
		keywords: [
			"Firmspace Dokumentation",
			"CRM Anleitung",
			"CRM Handbuch",
			"Automatisierung Anleitung",
			"KI-Assistent Hilfe",
		],
	},
	en: {
		title: "Documentation – Firmspace AI",
		description:
			"Step-by-step guides to every area of Firmspace AI: registration, CRM, tasks, finance, automation, the AI assistant and more.",
		keywords: ["Firmspace documentation", "CRM guide", "CRM manual", "automation guide", "AI assistant help"],
	},
	ua: {
		title: "Документація – Firmspace AI",
		description:
			"Покрокові інструкції до кожного розділу Firmspace AI: реєстрація, CRM, завдання, фінанси, автоматизація, ШІ-асистент та інше.",
		keywords: [
			"документація Firmspace",
			"інструкція CRM",
			"посібник CRM",
			"налаштування автоматизації",
			"довідка ШІ-асистента",
		],
	},
};

const CRUMB: Record<Locale, string> = { de: "Dokumentation", en: "Documentation", ua: "Документація" };

const SECTIONS: Record<Locale, string[]> = {
	de: [
		"Erste Schritte",
		"Übersicht",
		"CRM",
		"Aufgaben",
		"Buchhaltung",
		"Automatisierung",
		"Firmspace AI",
		"Marketing",
		"Tabellen",
		"Feed",
		"Chat und Anrufe",
		"Kalender",
		"Online-Dokumente",
		"Web-Mail",
		"Firma",
		"Einstellungen",
		"Integrationen",
		"Abrechnung",
	],
	en: [
		"Getting started",
		"Dashboard",
		"CRM",
		"Tasks",
		"Finance",
		"Automation",
		"Firmspace AI",
		"Marketing",
		"Tables",
		"Feed",
		"Chat and calls",
		"Calendar",
		"Online documents",
		"Web mail",
		"Company",
		"Settings",
		"Integrations",
		"Billing",
	],
	ua: [
		"Початок роботи",
		"Інформаційна панель",
		"CRM",
		"Завдання",
		"Бухгалтерія",
		"Автоматизація",
		"Firmspace AI",
		"Маркетинг",
		"Таблиці",
		"Стрічка",
		"Чат і дзвінки",
		"Календар",
		"Онлайн-документи",
		"Веб-пошта",
		"Фірма",
		"Налаштування",
		"Інтеграції",
		"Оплата",
	],
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
			"@type": "CollectionPage",
			name: SEO[locale].title,
			description: SEO[locale].description,
			url: siteUrl(locale, PATH),
			inLanguage: locale === "ua" ? "uk" : locale,
			hasPart: SECTIONS[locale].map((section) => ({
				"@type": "TechArticle",
				name: section,
				url: siteUrl(locale, PATH),
				isPartOf: siteUrl(locale, PATH),
			})),
		},
	];
}
