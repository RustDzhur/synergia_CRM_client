// app/[locale]/impressum.metadata.ts — SEO страницы Impressum (/impressum).
//
// Куда положить: /site/app/[locale]/impressum/metadata.ts (новый файл).
// Как подключить: в app/[locale]/impressum/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Page({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// ⚠️ content/footerPages.ts (IMPRESSUM) — шаблон: юр. название, адрес, реестр, USt-IdNr.
// и ответственное лицо стоят в [квадратных скобках]. Поэтому здесь НЕТ разметки
// LocalBusiness/Organization с реквизитами: публиковать заглушки в structured data нельзя.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/impressum";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Impressum – Firmspace AI",
		description:
			"Impressum und Anbieterkennzeichnung nach § 5 TMG: Angaben zum Anbieter von Firmspace AI, Vertretung, Registereintrag und Kontakt.",
		keywords: ["Impressum Firmspace", "Anbieterkennzeichnung", "§ 5 TMG", "Rechtliches"],
	},
	en: {
		title: "Legal notice (Impressum) – Firmspace AI",
		description:
			"Legal notice under § 5 TMG: provider information for Firmspace AI, representation, commercial register entry and contact details.",
		keywords: ["Firmspace legal notice", "Impressum", "§ 5 TMG", "provider information"],
	},
	ua: {
		title: "Правова інформація (Impressum) – Firmspace AI",
		description:
			"Правова інформація за § 5 TMG: дані про постачальника Firmspace AI, представника, реєстрацію та контакти.",
		keywords: ["правова інформація Firmspace", "Impressum", "§ 5 TMG", "дані постачальника"],
	},
};

const CRUMB: Record<Locale, string> = { de: "Impressum", en: "Legal notice", ua: "Правова інформація" };

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
