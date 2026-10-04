// app/[locale]/blog/2026-10-04-ai-action-v-avtomatizacii/page.tsx — статья блога: шаг «AI action» в правилах автоматизации.
//
// Статья статичная (не из БД): метаданные, canonical/hreflang и JSON-LD собираются общими
// помощниками из lib/seo.tsx — теми же, что и у /blog/[slug], — чтобы правило «de без префикса,
// en/uk с префиксом» не расходилось между статическими и динамическими статьями.
//
// Факты статьи проверены по коду: lib/automation/index.ts (EVENTS, ACTIONS, DELAY_MIN, render),
// lib/ai/automationStep.ts (один write-инструмент, MAX_STEPS = 4, права владельца, квота),
// components/crm/Automation/config.ts (вкладки rules/variables/constants/logs), lib/finance/reminders.ts
// (MAX_AUTO_LEVEL = 4), app/api/cron/automation. Ничего не выдумано.

import Image from "next/image";
import Link from "next/link";
import "react";
import type { Metadata } from "next";
import { JsonLd, asLocale, blogPostingLd, breadcrumbLd, pageMetadata, sitePath, type Locale } from "@/lib/seo";
import PageShell from "@/components/website/PageShell";
import { Footer, Navigation } from "@/components/website";

// Экспортировать из page.tsx можно только поля, которые разрешает Next (default, generateMetadata, …):
// лишний экспорт (pageJsonLd, SLUG) роняет проверку типов `.next/types/**` и сборку. Поэтому всё, кроме
// generateMetadata, здесь локальное — как в остальных страницах лендинга (см. app/[locale]/about/page.tsx).
const SLUG = "2026-10-04-ai-action-v-avtomatizacii";
const PATH = `/blog/${SLUG}`;
const PUBLISHED = "2026-10-04T00:00:00.000Z";

// Готовая картинка 1200×630 из public/images/blog (проверено: 1200×630) — для карточки и для openGraph/twitter.
// Отдельного изображения под эту статью нет — см. отчёт: предложено нарисовать своё.
const IMAGE = "/images/blog/ai-for-small-business-sales.jpg";

// Заголовок самой статьи — один для всех локалей (текст статьи на русском).
const HEADING = "Шаг AI action: что агент делает в автоматизации сам";

// Ключевые слова — только те, что уже лежат в keywords существующих metadata.ts
// (app/[locale]/metadata.ts, features, blog, services). Не больше 8 терминов.
const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "AI-Action: was der Agent im Workflow tut – Firmspace AI",
		description:
			"Der Schritt AI action in Automatisierungsregeln: welche CRM-Ereignisse es gibt, was der Agent selbst ausführt und wo der Mensch entscheidet.",
		keywords: [
			"KI CRM",
			"Automatisierung",
			"Deal-Pipeline",
			"Vertriebsautomatisierung",
			"Aufgabenverwaltung",
			"KI Automatisierung",
			"CRM Praxis",
			"gemeinsamer Kalender",
		],
	},
	en: {
		title: "AI action step: what the agent does alone – Firmspace AI",
		description:
			"The AI action step in automation rules: which CRM events fire, what the agent carries out on its own, and where a human still decides.",
		keywords: [
			"AI CRM",
			"automation",
			"deals pipeline",
			"sales automation",
			"task management",
			"AI automation",
			"CRM practice",
			"shared calendar",
		],
	},
	ua: {
		title: "Крок AI action: що агент робить сам – Firmspace AI",
		description:
			"Крок AI action у правилах автоматизації: які події CRM запускають правило, що агент виконує сам і де вирішує людина.",
		keywords: [
			"ШІ CRM",
			"автоматизація",
			"воронка угод",
			"автоматизація продажів",
			"керування завданнями",
			"ШІ автоматизація",
			"практика CRM",
			"спільний календар",
		],
	},
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
	const locale = asLocale(params.locale);
	return pageMetadata({
		path: PATH,
		locale,
		...SEO[locale],
		ogType: "article",
		images: [IMAGE],
		publishedTime: PUBLISHED,
	});
}

function pageJsonLd(localeCode: string) {
	const locale = asLocale(localeCode);
	return [
		breadcrumbLd(locale, [
			{ name: "Firmspace AI", path: "/" },
			{ name: "Blog", path: "/blog" },
			{ name: HEADING, path: PATH },
		]),
		blogPostingLd(locale, {
			slug: SLUG,
			title: HEADING,
			description: SEO[locale].description,
			publishedAt: PUBLISHED,
			image: IMAGE,
		}),
	];
}

export default function Page({ params }: { params: { locale: string } }) {
	const locale = asLocale(params.locale);
	return (
		<div className="lg:max-w-screen-lg m-auto">
			<Navigation />
			<PageShell
				title={HEADING}
				intro="Правило автоматизации ждёт событие в CRM и выполняет действие. Одно из действий — шаг AI action: вместо готового текста вы пишете инструкцию, и агент сам решает, что сделать."
			>
				<Image
					src={IMAGE}
					alt="Шаг AI action в правилах автоматизации Firmspace"
					width={1200}
					height={630}
					className="mb-30 w-full rounded-8 border border-[rgba(255,255,255,0.10)]"
					priority
				/>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Событие, правило, действие</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Раздел <code className="text-14 text-[#f1f4ee]">crm/automation</code> состоит из четырёх вкладок:
					rules, variables, constants и logs. Движок слушает восемнадцать событий — создание сделки или
					контакта, смену стадии, новый лид, полученное сообщение, пропущенный звонок, задачу и дедлайн,
					заказ и его статус, отправленный, оплаченный или просроченный счёт, подписанный договор,
					отправленное предложение. Правило срабатывает сразу либо с задержкой: через час, день или три дня.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Шаг AI action: инструкция вместо шаблона</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Действие выбирается из списка: уведомить команду, создать задачу, добавить заметку, передвинуть
					сделку, отправить письмо, вызвать webhook — или шаг{" "}
					<code className="text-14 text-[#f1f4ee]">ai_action</code>. В первых шести случаях вы пишете текст с
					подстановками вроде <code className="text-14 text-[#f1f4ee]">{"{{contact.name}}"}</code> или{" "}
					<code className="text-14 text-[#f1f4ee]">{"{{deal.stageName}}"}</code>. В шаге AI action вы пишете
					инструкцию — что сделать, когда правило сработало, — и модель сама подбирает инструмент и работает
					с данными фирмы.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Один изменяющий инструмент за запуск</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Рядом с автоматизацией нет человека, поэтому шаг устроен осторожнее чата: за один запуск агент
					выполняет не больше одного инструмента, который меняет данные, и до четырёх кругов рассуждения.
					Переходы по страницам (<code className="text-14 text-[#f1f4ee]">navigate</code>) здесь
					недоступны — они нужны только в диалоге. Если инструкция непонятна или уверенности нет, агент не
					делает ничего и объясняет почему.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Права, квота и журнал</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Шаг действует с правами владельца фирмы — как и остальные действия автоматизации, — и расходует ту
					же дневную квоту ИИ, что и чат. Результат виден во вкладке logs: название правила, дата, статус
					success или error и сообщение. Отдельный журнал ИИ доступен в{" "}
					<code className="text-14 text-[#f1f4ee]">api/ai/log</code>.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Где это работает в сделке</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Правило на событие <code className="text-14 text-[#f1f4ee]">deal_stage</code> может, например,
					подготовить задачу следующего шага, на <code className="text-14 text-[#f1f4ee]">invoice_overdue</code>{" "}
					— собрать письмо-напоминание. События <code className="text-14 text-[#f1f4ee]">deadline</code> и{" "}
					<code className="text-14 text-[#f1f4ee]">task_created</code> связывают автоматизацию с задачами и
					календарём, <code className="text-14 text-[#f1f4ee]">contract_signed</code> — с договорами, а{" "}
					<code className="text-14 text-[#f1f4ee]">lead_created</code> и{" "}
					<code className="text-14 text-[#f1f4ee]">message_received</code> — с каналами и заявками.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Человек остаётся в контуре</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Шаг AI action включают осознанно: в окне правила интерфейс предупреждает, что действие выполнится
					без подтверждения. Это и есть согласие владельца фирмы — оно даётся один раз, при включении шага.
					Там, где цена ошибки выше, автоматика останавливается сама: ступени напоминаний выше
					четвёртой не поднимаются, дальше решает человек. А удаление в чате подтверждается всегда.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Итог</h2>
				<p className="text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Правила ведут сделку по стадиям, а шаг AI action добавляет туда решение, которое не опишешь
					шаблоном. Остальные возможности платформы — в разделе{" "}
					<Link href={sitePath(locale, "/features")} className="text-authBtn">
						возможности Firmspace AI
					</Link>
					.
				</p>
			</PageShell>
			<JsonLd data={pageJsonLd(locale)} />
			<Footer />
		</div>
	);
}
