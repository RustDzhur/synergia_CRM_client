// app/[locale]/layout.metadata.ts — метаданные уровня всего сайта (все три языка).
//
// Куда положить: /site/app/[locale]/layout.metadata.ts (новый файл).
// Как подключить: в app/[locale]/layout.tsx удалить статический `export const metadata`
// (title «Firmspace AI» + немецкое description) и заменить его на:
//
//   export { generateMetadata } from "./layout.metadata";
//
// Почему так: layout — единственное место, где задаётся metadataBase. Без него Next не может
// собрать абсолютные адреса для canonical/openGraph, и они уезжают относительными.

import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, asLocale, type Locale } from "@/lib/seo";

const DEFAULTS: Record<Locale, { title: string; description: string }> = {
	de: {
		title: "Firmspace AI – CRM, Projekte und Buchhaltung",
		description:
			"CRM, Team-Kommunikation, Projekte und Buchhaltung in einer Plattform – für kleine und mittlere Unternehmen.",
	},
	en: {
		title: "Firmspace AI – CRM, projects and accounting",
		description:
			"CRM, team communication, projects and accounting in one platform – built for small and mid-sized companies.",
	},
	ua: {
		title: "Firmspace AI – CRM, проєкти та бухгалтерія",
		description:
			"CRM, звʼязок із командою, проєкти та бухгалтерія в одній платформі — для малого й середнього бізнесу.",
	},
	uz: {
		title: "Firmspace AI – CRM, loyihalar va buxgalteriya",
		description:
			"CRM, jamoa muloqoti, loyihalar va buxgalteriya bitta platformada — kichik va o'rta biznes uchun.",
	},
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	const fallback = DEFAULTS[locale];

	return {
		// База для всех относительных адресов в metadata дочерних сегментов.
		metadataBase: new URL(SITE_URL),
		// Значение по умолчанию: каждая страница переопределяет title и description своими.
		// Обычная строка, а не { default } — в этой версии Next DefaultTemplateString требует ещё и template.
		title: fallback.title,
		description: fallback.description,
		applicationName: SITE_NAME,
		authors: [{ name: SITE_NAME, url: SITE_URL }],
		creator: SITE_NAME,
		publisher: SITE_NAME,
		formatDetection: { email: false, address: false, telephone: false },
	};
}
