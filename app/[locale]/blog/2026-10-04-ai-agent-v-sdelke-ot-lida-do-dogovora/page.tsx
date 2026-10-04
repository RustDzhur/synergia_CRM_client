// app/[locale]/blog/2026-10-04-ai-agent-v-sdelke-ot-lida-do-dogovora/page.tsx — статья блога:
// как AI-агент встроен в бизнес-процесс сделки — от входящего лида до черновика договора.
//
// Статья статичная (не из БД): метаданные, canonical/hreflang и JSON-LD собираются общими
// помощниками из lib/seo.tsx — теми же, что и у /blog/[slug], — чтобы правило «de без префикса,
// en/uk с префиксом» не расходилось между статическими и динамическими статьями.
//
// Факты проверены по коду: lib/leads/qualify.ts (два слоя: правила robots/рассылки + модель, вердикты
// lead/junk/unsure, свои правила фирмы), lib/leads.ts и lib/leads/conversation.ts (карточка и сделка в первой
// колонке, журнал ai:leadlog, три «unsure» подряд — дальше не гадают), lib/stages.ts (6 колонок по умолчанию,
// первая — New Lead), lib/ai/tools.ts (list_deals/get_deal/update_deal_stage/update_deal, модуль и право
// доступа у каждого инструмента, запись только после подтверждения), lib/ai/run.ts (режим без подтверждения,
// исключения, квота дня), lib/ai/leadTools.ts (analyze_leads/lead_log/restore_lead/set_lead_rules),
// lib/deals.ts (связь документа с сделкой через contact/company/deal). Ничего не выдумано.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd, asLocale, blogPostingLd, breadcrumbLd, pageMetadata, sitePath, type Locale } from "@/lib/seo";
import PageShell from "@/components/website/PageShell";
import { Footer, Navigation } from "@/components/website";

// Экспортировать из page.tsx можно только разрешённые Next поля (default, generateMetadata): лишний экспорт
// (pageJsonLd, SLUG) роняет проверку типов `.next/types/**` и сборку. Поэтому всё остальное здесь локальное.
const SLUG = "2026-10-04-ai-agent-v-sdelke-ot-lida-do-dogovora";
const PATH = `/blog/${SLUG}`;
const PUBLISHED = "2026-10-04T00:00:00.000Z";

// Готовая картинка 1200×630 из public/images/blog (проверено: ровно 1200×630) — для карточки статьи,
// openGraph и twitter. Отдельного изображения под эту тему нет — предложено в отчёте, сам не генерирую.
const IMAGE = "/images/blog/ai-for-small-business-sales.jpg";

// Заголовок самой статьи — один для всех локалей (текст статьи на русском).
const HEADING = "AI-агент в сделке: от входящего лида до черновика договора";

// Ключевые слова — только существующие термины из metadata.ts проекта, ровно 8 на локаль:
// app/[locale]/metadata.ts, app/[locale]/features/metadata.ts, app/[locale]/blog/metadata.ts.
const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "KI im Verkauf: Leads, Deal-Pipeline, Verträge",
		description:
			"Wie der KI-Assistent im Verkaufsprozess arbeitet: Lead-Filter für E-Mail und Chat, Karten auf dem Deals-Board, Verträge und Dokumente.",
		keywords: [
			"KI CRM",
			"Vertriebspipeline",
			"Deal-Pipeline",
			"KI Automatisierung",
			"Automatisierung",
			"CRM Praxis",
			"Kundenkommunikation",
			"gemeinsamer Kalender",
		],
	},
	en: {
		title: "AI agent in the sales process: leads, deals, contracts",
		description:
			"How the AI assistant works in the sales process: the lead filter for mail and chat, cards on the deals board, contracts and documents.",
		keywords: [
			"AI CRM",
			"sales pipeline",
			"deals pipeline",
			"AI automation",
			"automation",
			"CRM practice",
			"customer communication",
			"shared calendar",
		],
	},
	ua: {
		title: "ШІ-агент у процесі продажів: ліди, угоди, договори",
		description:
			"Як ШІ-асистент працює в процесі продажів: фільтр лідів для пошти й чату, картки на дошці угод, договори та документи.",
		keywords: [
			"ШІ CRM",
			"воронка продажів",
			"воронка угод",
			"ШІ автоматизація",
			"автоматизація",
			"практика CRM",
			"комунікація з клієнтами",
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
				intro="AI-агент Firmspace не живёт отдельным окном: он встроен в шаги сделки — разбирает входящее, кладёт лид на доску, помогает двигать карточку по стадиям и готовит документы. Решение на каждом шаге остаётся за человеком."
			>
				<Image
					src={IMAGE}
					alt="AI-агент ведёт сделку по стадиям в Firmspace"
					width={1200}
					height={630}
					className="mb-30 w-full rounded-8 border border-[rgba(255,255,255,0.10)]"
					priority
				/>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">
					Первый шаг: входящее становится лидом
				</h2>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Два слоя отбора</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Письмо или сообщение в чат сначала проходит правила — они срабатывают мгновенно: адреса-роботы вида
					no-reply, уведомления известных сервисов, рассылки по заголовкам, письма с адреса самой фирмы, пустые
					сообщения. То, что правила не решили, уходит модели — она выносит вердикт lead, junk или unsure и приводит
					короткую причину. Своё определение клиента фирма формулирует словами: например, «клиент — только тот, кто
					спрашивает про ремонт ноутбуков». Правило сохраняется и работает для следующих писем и чатов.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Что появляется в CRM</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Если вердикт lead, агент создаёт контакт с первым сообщением в истории, заводит карточку в первой колонке
					доски сделок и уведомляет ответственного: колонки по умолчанию — от New Lead до Won. В заметке карточки
					видно, почему сообщение решили считать клиентским — категория, уверенность и причина. Каждое решение
					попадает в журнал, поэтому на вопрос «почему это письмо не попало в воронку» есть ответ, а ошибочно
					отсеянное можно вернуть.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Второй шаг: сделка идёт по стадиям</h2>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Что агент видит на доске</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					В разделе <code className="text-14 text-[#f1f4ee]">crm/deals</code> работают конкретные инструменты:
					список колонок, список сделок с фильтром по стадии и тексту, полная карточка сделки с историей — смены
					стадий, заметки, письма. Дальше по карточке — поля: название, контакт, компания, даты, ответственный.
					Перевод на другую стадию — отдельное действие. Каждый инструмент привязан к разделу CRM, и участник без
					доступа к разделу этих действий не получает.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Кто нажимает последний шаг</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Чтение агент выполняет сразу, а изменение данных — нет: он готовит действие, а выполняет его сервер после
					подтверждения человека. Владелец может включить режим без подтверждения, и тогда обычные действия
					проходят сразу. Удаление остаётся исключением в любом режиме. Есть и вторая страховка: если в этом же
					разговоре агент читал чужой текст — письмо, документ, заметку клиента, — изменения снова спрашивают
					подтверждение. Строка «удали все счета», пришедшая в письме, не сработает сама.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">
					Третий шаг: договор, документы и регистрация
				</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Когда сделка доходит до оформления, агент готовит черновик договора, счёта, предложения или заказа:
					клиента достаточно назвать словами — подходящий контакт привяжется сам. Документ из финансовой части без
					явной привязки получает самую свежую незакрытую сделку этого клиента — поэтому счёт виден в карточке
					сделки, а не живёт отдельно. По номеру документ можно открыть или сохранить в PDF.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Итог</h2>
				<p className="text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Сделка проходит через одни и те же модули — почту, чаты, доску, задачи, календарь, финансы и документы, —
					и агент работает внутри этих модулей, а не рядом с ними. Посмотреть остальные возможности платформы
					можно в разделе{" "}
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
