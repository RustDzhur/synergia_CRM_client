// app/[locale]/contacts.metadata.ts — SEO страницы «Контакты» (/contacts).
//
// Куда положить: /site/app/[locale]/contacts/metadata.ts (новый файл).
// Как подключить: в app/[locale]/contacts/page.tsx добавить
//
//   import { JsonLd } from "@/lib/seo";
//   export { generateMetadata, pageJsonLd } from "./metadata";
//   export default function Contacts({ params }: { params: { locale: string } }) { ... <JsonLd data={pageJsonLd(params.locale)} /> ... }
//
// ⚠️ ВНИМАНИЕ. ContactPoint ниже использует значения из content/sitePages.ts
// (hello@firmspace.example, +49 30 1234 5678, Friedrichstraße 100, 10117 Berlin).
// Домен .example зарезервирован под документацию, то есть это демо-данные, а Impressum
// в коде — шаблон с [заглушками]. Перед публикацией замените CONTACT в lib/seo.tsx
// на реальные реквизиты, иначе в разметке окажутся нерабочие контакты.

import type { Metadata } from "next";
import { asLocale, breadcrumbLd, contactPointLd, organizationLd, pageMetadata, siteUrl, type Locale } from "@/lib/seo";

export const PATH = "/contacts";

const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Kontakt – Firmspace AI",
		description:
			"Fragen zu Firmspace AI? Schreiben Sie uns über das Kontaktformular, per E-Mail oder Telefon – wir antworten in der Regel innerhalb eines Werktags.",
		keywords: [
			"Kontakt Firmspace AI",
			"CRM Support kontaktieren",
			"Beratung CRM",
			"Anfrage CRM Software",
			"Kontaktformular",
		],
	},
	en: {
		title: "Contact – Firmspace AI",
		description:
			"Questions about Firmspace AI? Write to us with the contact form, by e-mail or phone — we usually reply within one business day.",
		keywords: [
			"contact Firmspace AI",
			"contact CRM support",
			"CRM consultation",
			"CRM enquiry",
			"contact form",
		],
	},
	ua: {
		title: "Контакти – Firmspace AI",
		description:
			"Маєте запитання про Firmspace AI? Напишіть через форму, e-mail чи телефон — зазвичай відповідаємо протягом одного робочого дня.",
		keywords: [
			"контакти Firmspace AI",
			"звʼязок з підтримкою CRM",
			"консультація CRM",
			"запит CRM",
			"форма звʼязку",
		],
	},
	uz: {
		title: "Aloqa – Firmspace AI",
		description:
			"Firmspace AI haqida savollaringiz bormi? Forma, e-mail yoki telefon orqali yozing — odatda bir ish kuni ichida javob beramiz.",
		keywords: [
			"Firmspace AI aloqa",
			"CRM qo'llab-quvvatlashga bog'lanish",
			"CRM maslahat",
			"CRM so'rovi",
			"aloqa formasi",
		],
	},
};

const CRUMB: Record<Locale, string> = { de: "Kontakt", en: "Contact", ua: "Контакти", uz: "Aloqa" };

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
		// ContactPoint — только на этой странице (как и требует задание).
		organizationLd({ withContactPoint: true }),
		{
			"@context": "https://schema.org",
			"@type": "ContactPage",
			name: SEO[locale].title,
			description: SEO[locale].description,
			url,
			inLanguage: locale === "ua" ? "uk" : locale,
			mainEntity: contactPointLd(),
		},
	];
}
