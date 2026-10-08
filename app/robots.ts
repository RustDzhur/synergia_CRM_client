// app/robots.ts — правила обхода для поисковых роботов.
//
// Куда положить: заменить /site/app/robots.ts целиком.
//
// Что изменилось против текущей версии:
//   1) домен по умолчанию приведён к боевому APP_URL — https://firmspace.de (было www.firmspace.de,
//      а .env.local задаёт APP_URL=https://firmspace.de; расхождение давало Sitemap: на чужом хосте);
//   2) закрыт /de/crm — при localePrefix "as-needed" немецкий работает без префикса, но адрес /de/crm
//      всё равно существует и раньше оставался открытым;
//   3) закрыт /c/ (персональные ссылки на документы) во всех трёх языках;
//   4) добавлен Host (Яндекс), он поддержан в MetadataRoute.Robots этой версии Next.
//
// /pay/done в robots НЕ закрываем намеренно: страница отдаёт noindex, а запрет обхода помешал бы
// роботу увидеть этот noindex. Подробнее — REPORT.md, раздел «robots».
//
// ВАЖНО: /site/public/robots.txt конфликтует с этим файлом (оба претендуют на /robots.txt).
// Сейчас публичный файл проигрывает и не используется — его нужно удалить, см. PATCHES.md.

import type { MetadataRoute } from "next";

const SITE = (process.env.APP_URL ?? "https://firmspace.de").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: [
					"/api/",
					// Кабинет: закрыт для всех языков, включая немецкий с префиксом.
					"/crm",
					"/en/crm",
					"/ua/crm",
					"/de/crm",
					"/uz/crm",
					// Персональные ссылки на документы клиента.
					"/c/",
					"/en/c/",
					"/ua/c/",
					"/de/c/",
					"/uz/c/",
				],
			},
		],
		host: SITE,
		sitemap: `${SITE}/sitemap.xml`,
	};
}
