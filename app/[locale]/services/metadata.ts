// app/[locale]/services.metadata.ts — SEO страницы «Наши услуги» (/services).
//
// Куда положить: /site/app/[locale]/services/metadata.ts (новый файл).
// Как подключить: в app/[locale]/services/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Services({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// Названия и описания услуг взяты дословно из content/sitePages.ts (SERVICES.items) — ничего не выдумано.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, serviceCatalogLd, type Locale } from "@/lib/seo";

export const PATH = "/services";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Leistungen – CRM, Vertrieb, Support | Firmspace AI",
		description:
			"Kundendatenverwaltung, Vertriebsautomatisierung, Kundensupport, Marketing, Analysen und Integration – die Leistungen von Firmspace AI im Überblick.",
		keywords: [
			"CRM Leistungen",
			"Kundendatenverwaltung",
			"Vertriebsautomatisierung",
			"Kundensupport Software",
			"Marketing Software",
			"CRM Analytics",
			"CRM Integration",
		],
	},
	en: {
		title: "Services – CRM, sales and support | Firmspace AI",
		description:
			"Customer data management, sales automation, customer support, marketing, analytics and integration — an overview of what Firmspace AI does.",
		keywords: [
			"CRM services",
			"customer data management",
			"sales automation",
			"customer support software",
			"marketing software",
			"CRM analytics",
			"integrations",
		],
	},
	ua: {
		title: "Послуги – CRM, продажі та підтримка | Firmspace AI",
		description:
			"Управління даними клієнтів, автоматизація продажів, підтримка, маркетинг, аналітика та інтеграції — огляд можливостей Firmspace AI.",
		keywords: [
			"послуги CRM",
			"управління даними клієнтів",
			"автоматизація продажів",
			"підтримка клієнтів",
			"маркетингові інструменти",
			"аналітика CRM",
			"інтеграції",
		],
	},
	uz: {
		title: "Xizmatlar – CRM, savdo va qo'llab-quvvatlash | Firmspace AI",
		description:
			"Mijoz ma'lumotlarini boshqarish, savdoni avtomatlashtirish, qo'llab-quvvatlash, marketing, tahlil va integratsiya — Firmspace AI xizmatlari.",
		keywords: [
			"CRM xizmatlari",
			"mijoz ma'lumotlarini boshqarish",
			"savdoni avtomatlashtirish",
			"qo'llab-quvvatlash dasturi",
			"marketing dasturi",
			"CRM tahlili",
			"integratsiyalar",
		],
	},
};

const CRUMB: Record<Locale, string> = { de: "Unsere Leistungen", en: "Our services", ua: "Наші послуги", uz: "Bizning xizmatlarimiz" };

const SERVICES: Record<Locale, { name: string; description: string }[]> = {
	de: [
		{ name: "Kundendatenverwaltung", description: "Eine Karte für jeden Kontakt und jede Firma: Verlauf, Notizen, Deals und Dateien an einem Ort." },
		{ name: "Vertriebsautomatisierung", description: "Eine visuelle Deal-Pipeline mit Phasen, Erinnerungen und Regeln, die Deals voranbringen." },
		{ name: "Kundensupport und Service", description: "Kunden aus einem Posteingang beantworten: Chat, SMS, Anrufe, Telegram, Viber, Messenger und E-Mail." },
		{ name: "Marketing-Kampagnenmanagement", description: "Kampagnen, Anzeigen und Segmente planen und sehen, welche Kanäle Kunden bringen." },
		{ name: "Analysen und Berichte", description: "Dashboards für Deals, Aufgaben und Teamaktivität – klare Zahlen statt Vermutungen." },
		{ name: "Integration und Mobilität", description: "Telefonie, E-Mail und Messenger verbinden und mit einer responsiven Oberfläche auf jedem Gerät arbeiten." },
	],
	en: [
		{ name: "Customer Data Management", description: "One card for every contact and company: history, notes, deals and files in one place." },
		{ name: "Sales Automation", description: "A visual deals pipeline with stages, reminders and rules that move deals forward." },
		{ name: "Customer Support and Service", description: "Answer customers from one inbox: chat, SMS, calls, Telegram, Viber, Messenger and e-mail." },
		{ name: "Marketing Campaign Management", description: "Plan campaigns, ads and segments, and see which channels bring the customers." },
		{ name: "Analytics and Reporting", description: "Dashboards for deals, tasks and team activity — clear numbers instead of guesses." },
		{ name: "Integration and Mobility", description: "Connect telephony, mail and messengers, and work from any device with a responsive interface." },
	],
	ua: [
		{ name: "Управління даними клієнтів", description: "Одна картка для кожного контакту й компанії: історія, нотатки, угоди та файли в одному місці." },
		{ name: "Автоматизація продажів", description: "Візуальна воронка угод з етапами, нагадуваннями та правилами, які просувають угоди." },
		{ name: "Підтримка та обслуговування клієнтів", description: "Відповідайте клієнтам з однієї скриньки: чат, SMS, дзвінки, Telegram, Viber, Messenger та e-mail." },
		{ name: "Керування маркетинговими кампаніями", description: "Плануйте кампанії, рекламу та сегменти й бачте, які канали приводять клієнтів." },
		{ name: "Аналітика та звіти", description: "Дашборди для угод, завдань та активності команди — чіткі цифри замість здогадок." },
		{ name: "Інтеграція та мобільність", description: "Підключайте телефонію, пошту й месенджери та працюйте з будь-якого пристрою." },
	],
	uz: [
		{ name: "Mijoz ma'lumotlarini boshqarish", description: "Har bir kontakt va kompaniya uchun bitta karta: tarix, eslatmalar, bitimlar va fayllar bitta joyda." },
		{ name: "Savdoni avtomatlashtirish", description: "Bosqichlar, eslatmalar va bitimlarni oldinga suradigan qoidalar bilan vizual bitimlar voronkasi." },
		{ name: "Mijozlarni qo'llab-quvvatlash va xizmat", description: "Mijozlarga bitta pochta qutisidan javob bering: chat, SMS, qo'ng'iroqlar, Telegram, Viber, Messenger va e-mail." },
		{ name: "Marketing kampaniyalarini boshqarish", description: "Kampaniyalar, reklama va segmentlarni rejalashtiring va qaysi kanallar mijoz keltirishini ko'ring." },
		{ name: "Tahlil va hisobotlar", description: "Bitimlar, vazifalar va jamoa faolligi uchun dashbordlar — taxminlar o'rniga aniq raqamlar." },
		{ name: "Integratsiya va mobillik", description: "Telefoniya, pochta va messenjerlarni ulang va moslashuvchan interfeys bilan istalgan qurilmadan ishlang." },
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
		serviceCatalogLd(locale, SERVICES[locale]),
	];
}
