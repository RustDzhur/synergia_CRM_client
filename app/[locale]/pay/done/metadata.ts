// app/[locale]/pay/done.metadata.ts — метаданные публичной страницы возврата после оплаты (/pay/done).
//
// Куда положить: /site/app/[locale]/pay/done/metadata.ts (новый файл).
// Как подключить: в app/[locale]/pay/done/page.tsx добавить
//
//   export { generateMetadata } from "./metadata";
//
// Страница техническая (сюда приводит returnUrl из /api/invoices/:id/payment-link),
// ценности в поиске не несёт: noindex/nofollow и без canonical/hreflang.
// В sitemap её тоже нет — см. output/app/sitemap.ts.

import type { Metadata } from "next";
import { NO_INDEX_ROBOTS, asLocale, type Locale } from "@/lib/seo";

const TITLE: Record<Locale, string> = {
	de: "Zahlung erhalten – Firmspace AI",
	en: "Payment received – Firmspace AI",
	ua: "Оплату отримано – Firmspace AI",
};

const DESCRIPTION: Record<Locale, string> = {
	de: "Bestätigung, dass die Zahlung durchgegangen ist.",
	en: "Confirmation that the payment went through.",
	ua: "Підтвердження, що платіж пройшов.",
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return {
		title: TITLE[locale],
		description: DESCRIPTION[locale],
		robots: NO_INDEX_ROBOTS,
	};
}
