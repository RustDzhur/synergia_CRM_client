// app/[locale]/agb.metadata.ts — SEO страницы условий (AGB, /agb).
//
// Куда положить: /site/app/[locale]/agb/metadata.ts (новый файл).
// Как подключить: в app/[locale]/agb/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// ⚠️ Текст AGB в content/footerPages.ts (TERMS) — шаблон: часть значений в [квадратных скобках],
// а разделы про оплату/отмену/ответственность требуют юридической проверки. В metadata это
// не выдумывается, но страницу не стоит продвигать, пока шаблон не заменён.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/agb";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "AGB – Firmspace AI",
		description:
			"Allgemeine Geschäftsbedingungen für Firmspace AI: Vertragsschluss, Tarife, Zahlung, Kündigung, Verfügbarkeit, Haftung und anwendbares Recht.",
		keywords: ["AGB Firmspace", "Nutzungsbedingungen CRM", "Vertragsbedingungen Software", "Kündigung Abo"],
	},
	en: {
		title: "Terms and conditions (AGB) – Firmspace AI",
		description:
			"Terms and conditions for using Firmspace AI: contract, plans, payment, cancellation, availability, liability and governing law.",
		keywords: ["Firmspace terms", "CRM terms of service", "software contract terms", "cancel subscription"],
	},
	ua: {
		title: "Умови надання послуг – Firmspace AI",
		description:
			"Умови користування Firmspace AI: укладення договору, тарифи, оплата, скасування, доступність, відповідальність і застосовне право.",
		keywords: ["умови Firmspace", "умови користування CRM", "договір на ПЗ", "скасування підписки"],
	},
};

const CRUMB: Record<Locale, string> = { de: "AGB", en: "Terms (AGB)", ua: "Умови (AGB)" };

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
		},
	];
}
