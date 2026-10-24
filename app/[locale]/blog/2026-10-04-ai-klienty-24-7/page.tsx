// app/[locale]/blog/2026-10-04-ai-klienty-24-7/page.tsx — статья блога: AI-агент работает с клиентами 24/7.
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
const SLUG = "2026-10-04-ai-klienty-24-7";
const PATH = `/blog/${SLUG}`;
const PUBLISHED = "2026-10-04T00:00:00.000Z";

// Готовая картинка 1200×630 из public/images/blog — для карточки статьи и для openGraph/twitter.
const IMAGE = "/images/blog/ai-for-small-business-bookkeeping.jpg";

// Заголовок самой статьи — один для всех локалей (текст статьи на русском).
const HEADING = "AI работает с клиентами 24/7: чат, звонки и документы";

// Ключевые слова — только те, что уже используются в app/[locale]/metadata.ts,
// app/[locale]/features/metadata.ts и app/[locale]/blog/metadata.ts. Не больше 8 терминов.
const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "AI-Agent 24/7: Chat, Anrufe und Belege – Firmspace AI",
		description:
			"Wie der KI-Assistent rund um die Uhr arbeitet: Web-Chat, Telegram, Anrufe, einheitlicher Posteingang sowie Belege, Verträge und Bankauszüge.",
		keywords: [
			"KI CRM",
			"Kundenkommunikation",
			"KI-Automatisierung",
			"einheitlicher Posteingang",
			"Web-Mail",
			"Automatisierung",
			"Rechnungsstellung",
			"Buchhaltungssoftware",
		],
	},
	en: {
		title: "AI agent 24/7: chat, calls and receipts – Firmspace AI",
		description:
			"How the AI assistant works around the clock: web chat, Telegram, calls, a unified inbox, plus receipts, contracts and bank statements.",
		keywords: [
			"AI CRM",
			"customer communication",
			"AI automation",
			"unified inbox",
			"web mail",
			"automation",
			"invoicing software",
			"accounting software",
		],
	},
	ua: {
		title: "ШІ-агент 24/7: чат, дзвінки та документи – Firmspace AI",
		description:
			"Як ШІ-асистент працює цілодобово: веб-чат, Telegram, дзвінки, єдина скринька, а також чеки, договори та банківські виписки.",
		keywords: [
			"ШІ CRM",
			"комунікація з клієнтами",
			"ШІ-автоматизація",
			"єдина скринька",
			"веб-пошта",
			"автоматизація",
			"виставлення рахунків",
			"бухгалтерія",
		],
	},
	uz: {
		title: "AI agent 24/7: chat, calls and receipts – Firmspace AI",
		description:
			"How the AI assistant works around the clock: web chat, Telegram, calls, a unified inbox, plus receipts, contracts and bank statements.",
		keywords: [
			"AI CRM",
			"customer communication",
			"AI automation",
			"unified inbox",
			"web mail",
			"automation",
			"invoicing software",
			"accounting software",
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
				intro="Клиент пишет в субботу вечером, а отвечает ему агент: он принимает обращение в веб-чате, Telegram или мессенджере, создаёт задачу и готовит документы — человек подключается к решению, а не к сортировке."
			>
				<Image
					src={IMAGE}
					alt="AI-агент Firmspace отвечает клиентам круглосуточно"
					width={1200}
					height={630}
					className="mb-30 w-full rounded-8 border border-[rgba(255,255,255,0.10)]"
					priority
				/>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Один агент — все каналы</h2>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Веб-чат на сайте</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Публичная точка входа — виджет веб-чата (
					<code className="text-14 text-[#f1f4ee]">api/webchat/[token]</code>). Он отдаёт посетителю
					приветствие, цвет, часы работы и быстрые вопросы, а ссылки показывает только на те каналы, которые
					действительно подключены — Telegram, Viber или WhatsApp. Вести человека в никуда платформа не даёт.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Telegram и звонки</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Отдельный бот Айрис принимает текст и голосовые сообщения: сказанное распознаётся, разбирается на
					поручения и выполняется в CRM с правами того, кто подключил бота. Изменения применяются сразу — кроме
					удаления и случаев, когда агент читал чужой текст: тогда он переспрашивает. Звонки в браузере и их
					история собираются в разделе{" "}
					<code className="text-14 text-[#f1f4ee]">crm/collaboration/chat-and-calls</code> по всем
					провайдерам.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Что происходит с обращением</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Сообщение попадает в единый инбокс. Агент отвечает на типовые вопросы, определяет тему и приоритет, а
					если нужен человек — создаёт задачу в{" "}
					<code className="text-14 text-[#f1f4ee]">crm/tasks</code>: она сразу появляется в ленте (
					<code className="text-14 text-[#f1f4ee]">crm/collaboration/feed</code>). Перспективная заявка уходит
					в воронку сделок, а календарь фирмы синхронизируется с Google Calendar и iCloud, чтобы встречи не
					терялись.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Документы и деньги</h2>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Чеки и расходы</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Загруженный чек (<code className="text-14 text-[#f1f4ee]">api/documents/upload</code>) агент
					распознаёт и превращает в черновик расхода (
					<code className="text-14 text-[#f1f4ee]">api/expenses/extract</code>): он возвращает предложенные
					поля, а сам расход не создаёт — цифры проверяет человек.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Договоры, банк и файлы</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Договор готовится и подписывается в разделе договоров. Выписки подтягиваются из monobank и
					ПриватБанка (<code className="text-14 text-[#f1f4ee]">api/bank/monobank</code>,{" "}
					<code className="text-14 text-[#f1f4ee]">api/bank/privatbank</code>): подключение, привязка счёта,
					синхронизация. Документы лежат в онлайн-документах, а файлы можно подключить через Google Drive.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Что агент не делает сам</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Финансовые документы он только готовит: подтверждение, подпись и отправку делает человек. Дневной
					лимит ИИ — общий для чата и распознавания чеков — зависит от тарифа.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Итог</h2>
				<p className="text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Клиент получает ответ сразу, а не в рабочие часы, команда — готовую задачу и черновик документа.
					Агент работает с реальными данными Firmspace: все цифры берутся из вашей CRM. Больше о платформе — в
					разделе{" "}
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
