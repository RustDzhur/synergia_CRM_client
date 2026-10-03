// app/[locale]/crm.metadata.ts — метаданные кабинета (/crm и все вложенные разделы).
//
// Куда положить: /site/app/[locale]/crm/metadata.ts (новый файл).
//
// ⚠️ ОСОБЕННОСТЬ КОДА: app/[locale]/crm/layout.tsx начинается с "use client",
// а из клиентского компонента экспортировать metadata/generateMetadata нельзя — Next
// такую сборку не пропустит. Поэтому выберите один из двух путей (подробно в PATCHES.md):
//
//   А) Переделать layout на серверный (рекомендуется):
//      1) вынести текущее содержимое в /site/components/crm/CrmShell.tsx с "use client";
//      2) новый app/[locale]/crm/layout.tsx без "use client":
//           import type { Metadata } from "next";
//           import CrmShell from "@/components/crm/CrmShell";
//           export { generateMetadata } from "./metadata";
//           export default function CrmLayout({ children }: { children: React.ReactNode }) {
//             return <CrmShell>{children}</CrmShell>;
//           }
//
//   Б) Ничего не рефакторить, а закрыть кабинет HTTP-заголовком X-Robots-Tag
//      (см. output/next.config.headers.js) + правилами в output/app/robots.ts.
//
// Кабинет закрыт авторизацией: редиректит на главную без входа, содержимое персональное.
// Его не индексируем, но и не «прячем» через robots.txt как единственный барьер.

import type { Metadata } from "next";
import { NO_INDEX_ROBOTS, asLocale, type Locale } from "@/lib/seo";

const TITLE: Record<Locale, string> = {
	de: "Firmspace AI – CRM",
	en: "Firmspace AI – CRM",
	ua: "Firmspace AI – CRM",
};

const DESCRIPTION: Record<Locale, string> = {
	de: "Arbeitsbereich von Firmspace AI für angemeldete Nutzer.",
	en: "The Firmspace AI workspace for signed-in users.",
	ua: "Робочий простір Firmspace AI для авторизованих користувачів.",
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return {
		title: TITLE[locale],
		description: DESCRIPTION[locale],
		robots: NO_INDEX_ROBOTS,
	};
}
