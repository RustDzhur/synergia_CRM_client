// app/[locale]/features.metadata.ts — SEO страницы «Функции» (/features).
//
// Куда положить: /site/app/[locale]/features/metadata.ts (новый файл).
// Как подключить: в app/[locale]/features/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// Список функций — из content/footerPages.ts (FEATURES.items), цены — из config/plans.ts.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, softwareApplicationLd, type Locale } from "@/lib/seo";

export const PATH = "/features";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Funktionen – Firmspace AI Plattform",
		description:
			"Deal-Pipeline, Kontakte und Firmen, Aufgaben und Kalender, einheitlicher Posteingang, Anrufe im Browser, Web-Mail, Automatisierung und Marketing.",
		keywords: [
			"CRM Funktionen",
			"Deal-Pipeline",
			"Kontaktverwaltung",
			"Aufgabenverwaltung",
			"gemeinsamer Kalender",
			"einheitlicher Posteingang",
			"Web-Mail",
			"Automatisierung",
		],
	},
	en: {
		title: "Features – the Firmspace AI platform",
		description:
			"Deals pipeline, contacts and companies, tasks and calendar, unified inbox, browser calls, web mail, automation and marketing tools.",
		keywords: [
			"CRM features",
			"deals pipeline",
			"contact management",
			"task management",
			"shared calendar",
			"unified inbox",
			"web mail",
			"automation",
		],
	},
	ua: {
		title: "Функції – платформа Firmspace AI",
		description:
			"Воронка угод, контакти й компанії, завдання та календар, єдина скринька, дзвінки в браузері, веб-пошта, автоматизація й маркетинг.",
		keywords: [
			"функції CRM",
			"воронка угод",
			"керування контактами",
			"керування завданнями",
			"спільний календар",
			"єдина скринька",
			"веб-пошта",
			"автоматизація",
		],
	},
};

const CRUMB: Record<Locale, string> = { de: "Funktionen", en: "Features", ua: "Функції" };

const FEATURE_LIST: Record<Locale, string[]> = {
	de: [
		"Deal-Pipeline",
		"Kontakte und Firmen",
		"Aufgaben und Kalender",
		"Einheitlicher Posteingang",
		"Anrufe im Browser",
		"Web-Mail",
		"Automatisierung",
		"Marketing-Werkzeuge",
		"Bestandsverwaltung",
	],
	en: [
		"Deals pipeline",
		"Contacts and companies",
		"Tasks and calendar",
		"Unified inbox",
		"Calls in the browser",
		"Web mail",
		"Automation",
		"Marketing tools",
		"Inventory management",
	],
	ua: [
		"Воронка угод",
		"Контакти та компанії",
		"Завдання та календар",
		"Єдина скринька",
		"Дзвінки в браузері",
		"Веб-пошта",
		"Автоматизація",
		"Маркетингові інструменти",
		"Керування запасами",
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
		softwareApplicationLd(locale, {
			description: SEO[locale].description,
			features: FEATURE_LIST[locale],
		}),
	];
}
