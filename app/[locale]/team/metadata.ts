// app/[locale]/team.metadata.ts — SEO страницы команды (/team).
//
// Куда положить: /site/app/[locale]/team/metadata.ts (новый файл).
// Как подключить: в app/[locale]/team/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// Состав команды — из content/footerPages.ts (TEAM.members).

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/team";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Team – die Menschen hinter Firmspace AI",
		description:
			"Das Team hinter Firmspace AI: Entwicklung, Design, Customer Success und Marketing – Menschen, die die Plattform bauen und Fragen beantworten.",
		keywords: ["Firmspace Team", "CRM Unternehmen", "über das Team", "Ansprechpartner CRM"],
	},
	en: {
		title: "Team – the people behind Firmspace AI",
		description:
			"The team behind Firmspace AI: engineering, design, customer success and marketing — the people who build the platform and answer your questions.",
		keywords: ["Firmspace team", "CRM company", "about the team", "CRM contacts"],
	},
	ua: {
		title: "Команда – люди, які створюють Firmspace AI",
		description:
			"Команда Firmspace AI: розробка, дизайн, customer success і маркетинг — люди, які створюють платформу й відповідають на запитання.",
		keywords: ["команда Firmspace", "компанія CRM", "про команду", "контакти CRM"],
	},
	uz: {
		title: "Jamoa – Firmspace AI ortidagi odamlar",
		description:
			"Firmspace AI jamoasi: muhandislik, dizayn, mijozlar muvaffaqiyati va marketing — platformani yaratadigan va savollaringizga javob beradigan odamlar.",
		keywords: ["Firmspace jamoasi", "CRM kompaniyasi", "jamoa haqida", "CRM aloqalari"],
	},
};

const CRUMB: Record<Locale, string> = { de: "Team", en: "Team", ua: "Команда", uz: "Jamoa" };

const MEMBERS: Record<Locale, { name: string; role: string }[]> = {
	de: [
		{ name: "Anna Keller", role: "CEO & Mitgründerin" },
		{ name: "Oleksandr Shevchenko", role: "CTO" },
		{ name: "Lena Fischer", role: "Leiterin Design" },
		{ name: "Maksym Bondar", role: "Senior Engineer" },
		{ name: "Sophie Wagner", role: "Customer Success" },
		{ name: "Iryna Melnyk", role: "Marketing-Leiterin" },
	],
	en: [
		{ name: "Anna Keller", role: "CEO & Co-founder" },
		{ name: "Oleksandr Shevchenko", role: "CTO" },
		{ name: "Lena Fischer", role: "Head of Design" },
		{ name: "Maksym Bondar", role: "Senior Engineer" },
		{ name: "Sophie Wagner", role: "Customer Success" },
		{ name: "Iryna Melnyk", role: "Marketing Lead" },
	],
	ua: [
		{ name: "Anna Keller", role: "CEO та співзасновниця" },
		{ name: "Oleksandr Shevchenko", role: "Технічний директор" },
		{ name: "Lena Fischer", role: "Керівниця дизайну" },
		{ name: "Maksym Bondar", role: "Провідний інженер" },
		{ name: "Sophie Wagner", role: "Успіх клієнтів" },
		{ name: "Iryna Melnyk", role: "Керівниця маркетингу" },
	],
	uz: [
		{ name: "Anna Keller", role: "CEO va hammuassisa" },
		{ name: "Oleksandr Shevchenko", role: "Texnik direktor" },
		{ name: "Lena Fischer", role: "Dizayn rahbari" },
		{ name: "Maksym Bondar", role: "Katta muhandis" },
		{ name: "Sophie Wagner", role: "Mijozlar muvaffaqiyati" },
		{ name: "Iryna Melnyk", role: "Marketing rahbari" },
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
			"@type": "AboutPage",
			name: SEO[locale].title,
			description: SEO[locale].description,
			url: siteUrl(locale, PATH),
			inLanguage: locale === "ua" ? "uk" : locale,
			about: {
				"@type": "Organization",
				name: "Firmspace AI",
				url: siteUrl(locale, "/"),
				employee: MEMBERS[locale].map((member) => ({
					"@type": "Person",
					name: member.name,
					jobTitle: member.role,
				})),
			},
		},
	];
}
