// app/[locale]/blog/2026-10-04-ai-kommunikaciya-24-7/page.tsx — статья блога:
// как AI-агент работает с клиентами 24/7 — веб-чат, мессенджеры, звонки и передача человеку.
//
// Статья статичная (не из БД): метаданные, canonical/hreflang и JSON-LD собираются общими
// помощниками из lib/seo.tsx — теми же, что и у /blog/[slug], — чтобы правило «de без префикса,
// en/uk с префиксом» не расходилось между статическими и динамическими страницами.
//
// Факты проверены по коду: app/api/webchat/[token]/messages/route.ts (публичный API виджета, CORS,
// лимит 20 сообщений в минуту на посетителя, botEnabled, молчание бота 30 минут после ответа человека,
// уведомление команде в Telegram с текстом и страницей), lib/ai/publicIris.ts (ответы по базе знаний
// без доступа к CRM и без инструментов, маркер [[HANDOFF]], суточный потолок PUBLIC_IRIS_DAILY = 400,
// запасной подбор по ключевым словам), lib/ai/tts.ts (языки ru/uk/de/en), lib/channels/index.ts
// (единая точка приёма сообщений и звонков, каналы вложений — Telegram и Viber, уведомление о пропущенном
// звонке), lib/leads/conversation.ts (заявка из чата, звонок без содержания лидом не считается),
// lib/ai/tools.ts и lib/ai/run.ts (инструменты по роли и разделу, недоверенные тексты, подтверждение,
// общая дневная квота ИИ). Ничего не выдумано.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, asLocale, blogPostingLd, breadcrumbLd, pageMetadata, sitePath, type Locale } from "@/lib/seo";
import PageShell from "@/components/website/PageShell";
import { Footer, Navigation } from "@/components/website";

// Экспортировать из page.tsx можно только разрешённые Next поля (default, generateMetadata): лишний экспорт
// (pageJsonLd, SLUG) роняет проверку типов `.next/types/**` и сборку. Поэтому всё остальное здесь локальное.
const SLUG = "2026-10-04-ai-kommunikaciya-24-7";
const PATH = `/blog/${SLUG}`;
const PUBLISHED = "2026-10-04T00:00:00.000Z";

// Готовая картинка 1200×630 из public/images/blog (проверено: ровно 1200×630) — для карточки статьи,
// openGraph и twitter. Отдельного изображения под эту тему нет — предложено в отчёте, сам не генерирую.
const IMAGE = "/images/blog/ai-for-small-business-sales.jpg";

// Заголовок самой статьи — один для всех локалей (текст статьи на русском).
const HEADING = "AI-агент и клиенты 24/7: чат, звонки и передача человеку";

// Ключевые слова — только существующие термины из metadata.ts проекта, ровно 8 на локаль:
// app/[locale]/metadata.ts, app/[locale]/features/metadata.ts, app/[locale]/blog/metadata.ts.
const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "KI-Agent 24/7: Chat, Anrufe und Übergabe – Firmspace AI",
		description:
			"Wie der KI-Assistent rund um die Uhr arbeitet: Web-Chat, Telegram und Viber, Anrufe im Browser — und wann ein Mensch übernimmt.",
		keywords: [
			"KI CRM",
			"Team-Kommunikation",
			"einheitlicher Posteingang",
			"Web-Mail",
			"gemeinsamer Kalender",
			"Automatisierung",
			"Kundenkommunikation",
			"KI Automatisierung",
		],
	},
	en: {
		title: "AI agent 24/7: chat, calls and human handoff – Firmspace AI",
		description:
			"How the AI assistant works around the clock: web chat, Telegram and Viber, browser calls — and when a person takes over.",
		keywords: [
			"AI CRM",
			"team communication",
			"unified inbox",
			"web mail",
			"shared calendar",
			"automation",
			"customer communication",
			"AI automation",
		],
	},
	ua: {
		title: "ШІ-агент 24/7: чат, дзвінки та людина – Firmspace AI",
		description:
			"Як ШІ-асистент працює цілодобово: веб-чат, Telegram і Viber, дзвінки в браузері — і коли підключається людина.",
		keywords: [
			"ШІ CRM",
			"командна комунікація",
			"єдина скринька",
			"веб-пошта",
			"спільний календар",
			"автоматизація",
			"комунікація з клієнтами",
			"ШІ автоматизація",
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
				intro="Клиент пишет вечером, в выходной или ночью — и ждёт ответа. В Firmspace на первой линии работает Айрис: она отвечает по базе знаний, собирает заявку в CRM и зовёт человека, когда вопрос требует человека."
			>
				<Image
					src={IMAGE}
					alt="Круглосуточная работа AI-агента с клиентами в Firmspace"
					width={1200}
					height={630}
					className="mb-30 w-full rounded-8 border border-[rgba(255,255,255,0.10)]"
					priority
				/>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">
					Первая линия: виджет чата на сайте
				</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Публичный API онлайн-чата рассчитан на виджет со стороннего сайта, поэтому у него открытый CORS, а права
					посетителя ограничены одной его беседой: идентификатор знает только его браузер. На сообщения отвечает
					Айрис по базе знаний о платформе — без доступа к данным CRM и без инструментов, то есть она не может
					случайно показать чужую сделку или счёт. Чего она не знает, вопрос про конкретный аккаунт, оплату,
					договор или скидку — она помечает и передаёт человеку, а посетителю предлагает оставить e-mail, если он
					уйдёт из чата. Новое обращение тут же уходит команде в Telegram, вместе со страницей, с которой пишет
					человек: «смотрит цены» — заметная подсказка для ответа.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">
					Мессенджеры, звонки и единая лента обращений
				</h2>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Один вход для всех каналов</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Раздел <code className="text-14 text-[#f1f4ee]">collaboration/chat-and-calls</code> — общая точка
					приёма: сообщения и звонки из каналов попадают в одну беседу с клиентом, вложения поддерживают Telegram и
					Viber, у остальных каналов — текст. Внутри CRM письма лежат в <code className="text-14 text-[#f1f4ee]">web mail</code>,
					поэтому контекст переписки не теряется между каналами.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Звонки в браузере</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Звонить и принимать звонки можно прямо в браузере. Пропущенный звонок без содержания лидом не считается —
					он остаётся в журнале звонков, и команда видит уведомление. Как только человек после этого напишет, его
					сообщение проходит обычную оценку.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Что видит команда</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Лента и календарь связывают обращения с работой команды: задача с дедлайном, запись в календаре и
					уведомление по конкретному клиенту не дают разговору потеряться. Дальше в дело вступают инструменты
					Айрис: она читает переписку и карточку клиента, готовит короткую сводку — кто, что, в каком состоянии,
					какой следующий шаг — и может предложить письмо-ответ на языке собеседника.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">
					Границы: когда агент молчит, а решает человек
				</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Круглосуточность не означает «бот вместо людей». Пока с посетителем недавно говорил человек, бот молчит —
					оператора он не перебивает, а в настройках канала его можно выключить совсем. Публичный API
					ограничивает частоту сообщений, у бота есть суточный потолок на весь сайт, а если он недоступен,
					отвечают готовые тексты по ключевым словам. В самом CRM инструменты выдаются по роли и разделу, тексты
					из писем, документов и заметок считаются недоверенными — инструкции из них не выполняются, поэтому
					изменения после чтения чужого текста требуют подтверждения. Дневная квота разговоров с ИИ общая для
					чата и автоматических действий: когда она исчерпана, агент не отвечает, а человек продолжает работать
					как обычно.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Итог</h2>
				<p className="text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Ночное сообщение не остаётся без ответа, заявка превращается в карточку, а сложный вопрос уходит человеку
					с готовым контекстом. Остальные возможности платформы — в разделе{" "}
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
