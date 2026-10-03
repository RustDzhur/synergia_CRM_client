// app/[locale]/page.metadata.ts — SEO главной страницы (/) для de / en / ua.
//
// Куда положить: /site/app/[locale]/page.metadata.ts (новый файл).
// Как подключить: в app/[locale]/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./page.metadata";
//   // и внутрь JSX:  <JsonLd data={pageJsonLd(params.locale)} />
//   // для этого сигнатура компонента: export default function Home({ params }: { params: { locale: string } })
//
// Canonical главной по-немецки — https://firmspace.de/ (de без префикса), en/ua — с префиксом.

import type { Metadata } from "next";
import { asLocale, organizationLd, pageMetadata, websiteLd, type Locale } from "@/lib/seo";

export const PATH = "/";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Firmspace AI – CRM, Projekte und Buchhaltung",
		description:
			"CRM, Team-Kommunikation, Projekte und Buchhaltung in einer Plattform: Kunden, Deals, Rechnungen, Aufgaben und der KI-Assistent arbeiten mit denselben Daten.",
		keywords: [
			"CRM Software",
			"KI CRM",
			"Kundenbeziehungsmanagement",
			"Vertriebspipeline",
			"Rechnungsstellung",
			"Projektmanagement",
			"Team-Kommunikation",
			"Buchhaltungssoftware",
		],
	},
	en: {
		title: "Firmspace AI – CRM, projects and accounting",
		description:
			"CRM, team communication, projects and accounting in one platform: customers, deals, invoices, tasks and the AI assistant work on the same data.",
		keywords: [
			"CRM software",
			"AI CRM",
			"customer relationship management",
			"sales pipeline",
			"invoicing software",
			"project management",
			"team communication",
			"accounting software",
		],
	},
	ua: {
		title: "Firmspace AI – CRM, проєкти та бухгалтерія",
		description:
			"CRM, звʼязок із командою, проєкти та бухгалтерія в одній платформі: клієнти, угоди, рахунки, завдання та ШІ-асистент працюють на спільних даних.",
		keywords: [
			"CRM система",
			"ШІ CRM",
			"управління клієнтами",
			"воронка продажів",
			"виставлення рахунків",
			"управління проєктами",
			"командна комунікація",
			"бухгалтерія",
		],
	},
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return pageMetadata({ path: PATH, locale, ...SEO[locale] });
}

const ORG_DESCRIPTION: Record<Locale, string> = {
	de: "Firmspace AI bringt Kundenbeziehungen, Teamarbeit, Projekte und Buchhaltung in ein Kabinett.",
	en: "Firmspace AI brings customer relationships, teamwork, projects and accounting into one cabinet.",
	ua: "Firmspace AI збирає роботу з клієнтами, командну роботу, проєкти й бухгалтерію в одному кабінеті.",
};

export function pageJsonLd(localeCode: string) {
	const locale = asLocale(localeCode);
	return [
		// Organization для главной. contactPoint намеренно не добавляем здесь:
		// контакты выводятся на /contacts (см. contacts.metadata.ts) и сейчас это демо-значения.
		organizationLd({ description: ORG_DESCRIPTION[locale] }),
		websiteLd(locale),
	];
}
