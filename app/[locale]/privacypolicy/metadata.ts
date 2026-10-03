// app/[locale]/privacypolicy.metadata.ts — SEO страницы политики конфиденциальности (/privacypolicy).
//
// Куда положить: /site/app/[locale]/privacypolicy/metadata.ts (новый файл).
// Как подключить: в app/[locale]/privacypolicy/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// Дата «September 2026» — из content/footerPages.ts (PRIVACY.updated); в коде она одинаковая
// на всех трёх языках, поэтому в metadata используется та же.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/privacypolicy";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Datenschutzerklärung – Firmspace AI",
		description:
			"Welche personenbezogenen Daten Firmspace AI verarbeitet, warum, wie sie geschützt werden und welche Rechte Sie haben – Stand September 2026.",
		keywords: [
			"Datenschutz Firmspace",
			"Datenschutzerklärung CRM",
			"DSGVO",
			"personenbezogene Daten",
			"Datensicherheit",
		],
	},
	en: {
		title: "Privacy policy – Firmspace AI",
		description:
			"What personal data Firmspace AI processes, why, how it is protected and what rights you have — last updated September 2026.",
		keywords: ["Firmspace privacy", "CRM privacy policy", "GDPR", "personal data", "data security"],
	},
	ua: {
		title: "Політика конфіденційності – Firmspace AI",
		description:
			"Які персональні дані обробляє Firmspace AI, навіщо, як вони захищені та які у вас права — оновлено у вересні 2026.",
		keywords: ["конфіденційність Firmspace", "політика конфіденційності CRM", "GDPR", "персональні дані", "безпека даних"],
	},
};

const CRUMB: Record<Locale, string> = {
	de: "Datenschutzerklärung",
	en: "Privacy policy",
	ua: "Політика конфіденційності",
};

const UPDATED = "2026-09-01";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return pageMetadata({
		path: PATH,
		locale,
		...SEO[locale],
		modifiedTime: new Date(UPDATED).toISOString(),
	});
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
			dateModified: new Date(UPDATED).toISOString(),
		},
	];
}
