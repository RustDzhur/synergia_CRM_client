// app/[locale]/blog/2026-10-04-ai-v-biznes-processah/page.tsx — статья блога: AI-агент в процессе сделок.
//
// Статья статичная (не из БД): метаданные, canonical/hreflang и JSON-LD собираются общими
// помощниками из lib/seo.tsx — теми же, что и у /blog/[slug], — чтобы правило «de без префикса,
// en/uk с префиксом» не расходилось между статическими и динамическими статьями.

import Image from "next/image";
import Link from "next/link";
import "react";
import type { Metadata } from "next";
import { JsonLd, asLocale, blogPostingLd, breadcrumbLd, pageMetadata, sitePath, type Locale } from "@/lib/seo";
import PageShell from "@/components/website/PageShell";
import { Footer, Navigation } from "@/components/website";

// Прогон 2026-10-04 (вечер): экспорт pageJsonLd/SLUG из page.tsx не разрешён Next — проверка типов
// `.next/types/**` падала и роняла сборку. Оставлены только разрешённые экспорты (generateMetadata, default).
const SLUG = "2026-10-04-ai-v-biznes-processah";
const PATH = `/blog/${SLUG}`;
const PUBLISHED = "2026-10-04T00:00:00.000Z";

// Готовая картинка 1200×630 из public/images/blog — годится и для карточки статьи, и для openGraph/twitter.
const IMAGE = "/images/blog/ai-for-small-business-sales.jpg";

// Заголовок самой статьи — один для всех локалей (текст статьи на русском).
const HEADING = "AI-агент в бизнес-процессах: как он работает со сделками";

// Ключевые слова — только те, что уже используются в app/[locale]/metadata.ts,
// app/[locale]/features/metadata.ts и app/[locale]/blog/metadata.ts. Не больше 8 терминов.
const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "KI im Vertrieb: AI-Agent im Deal-Prozess – Firmspace AI",
		description:
			"Wie der KI-Assistent in Firmspace Deals bearbeitet: Deal-Pipeline und Phasen, Kanal und Lead, Automatisierung, Verträge – jede Aktion bestätigt der Mensch.",
		keywords: [
			"KI CRM",
			"Deal-Pipeline",
			"Automatisierung",
			"KI-Automatisierung",
			"Vertriebspipeline",
			"CRM Praxis",
			"Aufgabenverwaltung",
			"gemeinsamer Kalender",
		],
	},
	en: {
		title: "AI in sales: how the agent works with deals – Firmspace AI",
		description:
			"How the AI assistant handles deals in Firmspace: deals pipeline and stages, channel and lead, automation, contracts – every action is confirmed by a human.",
		keywords: [
			"AI CRM",
			"deals pipeline",
			"automation",
			"AI automation",
			"sales pipeline",
			"CRM practice",
			"task management",
			"shared calendar",
		],
	},
	ua: {
		title: "ШІ у продажах: як агент працює з угодами – Firmspace AI",
		description:
			"Як ШІ-асистент працює з угодами у Firmspace: воронка угод і етапи, канал і лід, автоматизація, договори – кожну дію підтверджує людина.",
		keywords: [
			"ШІ CRM",
			"воронка угод",
			"автоматизація",
			"ШІ-автоматизація",
			"воронка продажів",
			"управління завданнями",
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
				intro="AI-агент Firmspace — не отдельный чат-бот: он работает поверх модулей CRM и доводит сделку от первой заявки до черновика договора, оставляя решение человеку."
			>
				<Image
					src={IMAGE}
					alt="AI-агент Firmspace в процессе сделок"
					width={1200}
					height={630}
					className="mb-30 w-full rounded-8 border border-[rgba(255,255,255,0.10)]"
					priority
				/>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Что агент видит в CRM</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Агент читает те же данные, что и сотрудник: доску сделок, контакты и компании, почту и беседы в
					мессенджерах. Набор инструментов привязан к разделам CRM: если у пользователя нет доступа к разделу,
					соответствующий инструмент ему не выдаётся.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Агент предлагает, а выполняет сервер</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Запись не срабатывает «молча»: агент готовит действие — перенос сделки, задачу, письмо, черновик
					договора — и показывает карточку подтверждения. Выполняет его сервер по адресу{" "}
					<code className="text-14 text-[#f1f4ee]">api/ai/actions</code>, от имени пользователя и с теми же
					проверками, что и обычный запрос к CRM. Исключение — включённый режим без подтверждения; удаление
					подтверждается всегда.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">От заявки до сделки</h2>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Стадии и колонки</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Доска сделок создаётся с шестью колонками: New Lead, Contacted, Qualified, Proposal, Negotiation, Won.
					Агент может переставить карточку инструментом{" "}
					<code className="text-14 text-[#f1f4ee]">update_deal_stage</code> — после подтверждения и с учётом
					прав роли.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Каналы и лиды</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Заявки приходят из разных каналов: веб-чат, мессенджеры, почта. У беседы есть поле канала, у сделки —
					источник и UTM-метки. Инструмент <code className="text-14 text-[#f1f4ee]">analyze_leads</code>{" "}
					разбирает то, что уже лежит в сделках, контактах, компаниях, почте и беседах;{" "}
					<code className="text-14 text-[#f1f4ee]">lead_log</code> показывает, что отсеяно и почему;{" "}
					<code className="text-14 text-[#f1f4ee]">restore_lead</code> возвращает ошибочно отсеянного клиента,
					а <code className="text-14 text-[#f1f4ee]">set_lead_rules</code> сохраняет ваше определение клиента.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Автоматизация, задачи и календарь</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Движок автоматизации в разделе <code className="text-14 text-[#f1f4ee]">crm/automation</code> слушает
					события сделок — создание и смену стадии — и рассылает уведомления команде со ссылкой на нужный
					раздел. Агент дополняет её там, где жёсткое правило не сработало: ставит задачу с дедлайном в{" "}
					<code className="text-14 text-[#f1f4ee]">crm/tasks</code>, пишет заметку в контакт, готовит письмо.
					Календарь фирмы синхронизируется с Google Calendar и iCloud.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Договоры, журнал и лимиты</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Черновик договора агент собирает сам, PDF формируется в разделе договоров, а подпись остаётся за
					человеком. Каждое чтение, предложение и выполненное действие попадает в журнал ИИ: последние 100
					записей доступны владельцу и администратору в{" "}
					<code className="text-14 text-[#f1f4ee]">api/ai/log</code>. Расход ИИ ограничен дневным лимитом
					тарифа и общий для чата и распознавания чеков.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Итог</h2>
				<p className="text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Агент берёт на себя рутину — разбор входящих, перенос карточек, черновики и напоминания, — а решение
					остаётся за сотрудником. Посмотреть остальные функции платформы можно в разделе{" "}
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
