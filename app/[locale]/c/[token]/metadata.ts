// app/[locale]/c/[token].metadata.ts — метаданные публичной страницы документа по ссылке (/c/<token>).
//
// Куда положить: /site/app/[locale]/c/[token]/metadata.ts (новый файл).
// Как подключить: в app/[locale]/c/[token]/page.tsx добавить
//
//   export { generateMetadata } from "./metadata";
//
// Ссылка и есть пропуск: страница открывает ровно один документ (счёт/предложение клиента).
// Поэтому страницу нельзя индексировать и нельзя отдавать в разметке данные документа —
// только нейтральный title. В sitemap такие URL не попадают, в robots.txt — /c/ закрыт.

import type { Metadata } from "next";
import { NO_INDEX_ROBOTS, asLocale, type Locale } from "@/lib/seo";

const TITLE: Record<Locale, string> = {
	de: "Dokument – Firmspace AI",
	en: "Document – Firmspace AI",
	ua: "Документ – Firmspace AI",
	uz: "Hujjat – Firmspace AI",
};

const DESCRIPTION: Record<Locale, string> = {
	de: "Dokument, das Ihnen über einen persönlichen Link bereitgestellt wurde.",
	en: "A document shared with you through a personal link.",
	ua: "Документ, наданий вам за персональним посиланням.",
	uz: "Sizga shaxsiy havola orqali taqdim etilgan hujjat.",
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return {
		title: TITLE[locale],
		description: DESCRIPTION[locale],
		robots: NO_INDEX_ROBOTS,
	};
}
