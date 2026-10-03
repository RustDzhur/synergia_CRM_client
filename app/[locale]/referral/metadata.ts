// app/[locale]/referral.metadata.ts — SEO страницы реферальной программы (/referral).
//
// Куда положить: /site/app/[locale]/referral/metadata.ts (новый файл).
// Как подключить: в app/[locale]/referral/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// Условия программы — из content/footerPages.ts (REFERRAL): бесплатный месяц и −10 % на первый год.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/referral";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Empfehlungsprogramm – Firmspace AI",
		description:
			"Empfehlen Sie Firmspace AI: Für jede Firma mit Abo erhalten Sie einen Gratismonat, die neue Firma 10 % Rabatt auf das erste Jahr.",
		keywords: ["Empfehlungsprogramm", "Referral CRM", "CRM empfehlen", "Prämie Software", "Partnerprogramm"],
	},
	en: {
		title: "Referral program – Firmspace AI",
		description:
			"Recommend Firmspace AI: get a free month for every company that subscribes, and the new company gets 10% off its first year.",
		keywords: ["referral program", "refer a CRM", "CRM referral", "software reward", "partner program"],
	},
	ua: {
		title: "Реферальна програма – Firmspace AI",
		description:
			"Рекомендуйте Firmspace AI: безкоштовний місяць за кожну компанію з підпискою, а нова компанія — знижка 10% на перший рік.",
		keywords: ["реферальна програма", "порекомендувати CRM", "винагорода за рекомендацію", "партнерська програма"],
	},
};

const CRUMB: Record<Locale, string> = { de: "Empfehlungsprogramm", en: "Referral program", ua: "Реферальна програма" };

const OFFER: Record<Locale, { name: string; description: string }> = {
	de: {
		name: "Empfehlungsprogramm",
		description: "Ein Gratismonat für den Empfehlenden, 10 % Rabatt auf das erste Jahr für die neue Firma.",
	},
	en: {
		name: "Referral program",
		description: "One free month for the referrer, 10% off the first year for the new company.",
	},
	ua: {
		name: "Реферальна програма",
		description: "Безкоштовний місяць для того, хто рекомендував, і знижка 10% на перший рік для нової компанії.",
	},
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return pageMetadata({ path: PATH, locale, ...SEO[locale] });
}

export function pageJsonLd(localeCode: string) {
	const locale = asLocale(localeCode);
	const url = siteUrl(locale, PATH);
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
			url,
			inLanguage: locale === "ua" ? "uk" : locale,
			mainEntity: {
				"@type": "Offer",
				name: OFFER[locale].name,
				description: OFFER[locale].description,
				url,
				priceCurrency: "EUR",
				availability: "https://schema.org/InStock",
				eligibleCustomerType: "https://schema.org/Business",
			},
		},
	];
}
