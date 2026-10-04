// app/[locale]/blog/2026-10-04-ai-scheta-i-napominaniya/page.tsx — статья блога: счета, напоминания и выписки банка.
//
// Статья статичная (не из БД): метаданные, canonical/hreflang и JSON-LD собираются общими
// помощниками из lib/seo.tsx — теми же, что и у /blog/[slug], — чтобы правило «de без префикса,
// en/uk с префиксом» не расходилось между статическими и динамическими статьями.
//
// Факты проверены по коду: lib/ai/tools.ts (create_invoice — черновик и подтверждение, send_invoice,
// mark_invoice_paid, list_invoices, finance_summary, email_report), lib/finance/overdue.ts,
// lib/finance/reminders.ts (интервал из настроек, MAX_AUTO_LEVEL = 4), lib/finance/dunning.ts,
// lib/finance/bankImport.ts, lib/banks/link.ts, lib/banks/monobank.ts, lib/banks/privatbank.ts,
// app/api/bank/*, app/api/expenses/extract. Ничего не выдумано.

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
const SLUG = "2026-10-04-ai-scheta-i-napominaniya";
const PATH = `/blog/${SLUG}`;
const PUBLISHED = "2026-10-04T00:00:00.000Z";

// Готовая картинка 1200×630 из public/images/blog (проверено: 1200×630) — для карточки и для openGraph/twitter.
// Отдельного изображения под эту статью нет — см. отчёт: предложено нарисовать своё.
const IMAGE = "/images/blog/ai-for-small-business-bookkeeping.jpg";

// Заголовок самой статьи — один для всех локалей (текст статьи на русском).
const HEADING = "Деньги под контролем: счета, напоминания и выписки";

// Ключевые слова — только те, что уже лежат в keywords существующих metadata.ts
// (app/[locale]/metadata.ts, features, blog, services). Не больше 8 терминов.
const SEO: Record<Locale, { title: string; description: string; keywords: string[] }> = {
	de: {
		title: "Buchhaltung mit KI: Rechnungen und Mahnungen – Firmspace AI",
		description:
			"Wie der KI-Assistent in Firmspace mit Geld arbeitet: Rechnungsentwurf, Versand, Zahlung, Mahnstufen und Bankauszüge aus monobank und PrivatBank.",
		keywords: [
			"KI CRM",
			"Rechnungsstellung",
			"Buchhaltungssoftware",
			"Automatisierung",
			"CRM Praxis",
			"Vertriebspipeline",
			"CRM Software",
			"gemeinsamer Kalender",
		],
	},
	en: {
		title: "AI in accounting: invoices, dunning and bank – Firmspace AI",
		description:
			"How the AI assistant handles money in Firmspace: invoice draft, sending, payment, dunning levels and bank statements from monobank and PrivatBank.",
		keywords: [
			"AI CRM",
			"invoicing software",
			"accounting software",
			"automation",
			"CRM practice",
			"sales pipeline",
			"CRM software",
			"shared calendar",
		],
	},
	ua: {
		title: "ШІ в бухгалтерії: рахунки та нагадування – Firmspace AI",
		description:
			"Як ШІ-асистент працює з грошима у Firmspace: чернетка рахунку, надсилання, оплата, ступені нагадувань і виписки monobank та ПриватБанку.",
		keywords: [
			"ШІ CRM",
			"виставлення рахунків",
			"бухгалтерія",
			"автоматизація",
			"практика CRM",
			"воронка продажів",
			"CRM система",
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
				intro="Ассистент в Firmspace не считает деньги вместо бухгалтера: он готовит черновики, отправляет их после подтверждения, следит за сроком оплаты и раскладывает банковские выписки — а решения остаются человеку."
			>
				<Image
					src={IMAGE}
					alt="Счета, напоминания и выписки банка в Firmspace AI"
					width={1200}
					height={630}
					className="mb-30 w-full rounded-8 border border-[rgba(255,255,255,0.10)]"
					priority
				/>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Счёт: черновик, отправка, оплата</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					В разделе <code className="text-14 text-[#f1f4ee]">crm/finance</code> счёт можно собрать вручную, а
					можно поручить ассистенту. Инструмент{" "}
					<code className="text-14 text-[#f1f4ee]">create_invoice</code> создаёт{" "}
					<em>черновик</em> счёта для клиента и только после подтверждения человеком. Черновик — ключевое
					слово: сам агент счёт не выставляет.
				</p>
				<h3 className="mb-8 text-18 font-medium text-[#f1f4ee]">Отправка и отметка об оплате</h3>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Инструмент <code className="text-14 text-[#f1f4ee]">send_invoice</code> отправляет черновик
					клиенту письмом с PDF из почты фирмы и переводит счёт в статус «отправлен» — тоже после
					подтверждения. Дальше события <code className="text-14 text-[#f1f4ee]">invoice_sent</code> и{" "}
					<code className="text-14 text-[#f1f4ee]">invoice_paid</code> подхватывает автоматизация. Оплату
					отмечает <code className="text-14 text-[#f1f4ee]">mark_invoice_paid</code> — полностью или
					частично, с суммой.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Просрочка: напоминания и ступени</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Раз в сутки крон <code className="text-14 text-[#f1f4ee]">api/cron/automation</code> проходит по
					счетам: «отправленные» с истёкшим сроком оплаты становятся «просроченными» и дают событие{" "}
					<code className="text-14 text-[#f1f4ee]">invoice_overdue</code> — один раз на счёт. Второй обход,{" "}
					<code className="text-14 text-[#f1f4ee]">api/cron/reminders</code>, поднимает ступень напоминания,
					если с прошлого напоминания прошёл интервал из настроек фирмы (по умолчанию семь дней). Ступени с
					первой по четвёртую автоматические; дальше автоматика не идёт, потому что начинается правовая
					стадия, и решение принимает человек. Проценты за просрочку считаются справочно и в счёт не
					включаются — окончательное слово за бухгалтером.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Выписки банка и сверка</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Выписки подтягиваются из monobank и ПриватБанка: счёт подключается в CRM, движения
					синхронизируются (<code className="text-14 text-[#f1f4ee]">api/bank/monobank</code>,{" "}
					<code className="text-14 text-[#f1f4ee]">api/bank/privatbank</code>). Дубликаты по внешнему
					идентификатору не создаются, а к каждой новой строке подбирается предполагаемая пара — счёт
					клиенту или расход. Уверенное совпадение (номер в назначении либо сумма и дата рядом) ставится
					сразу, слабое остаётся подсказкой человеку.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Расходы из чека и отчёты</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Фотография или PDF чека превращается в предложенные поля расхода (
					<code className="text-14 text-[#f1f4ee]">api/expenses/extract</code>) — сам расход создаёт
					человек. По цифрам фирмы ассистент отвечает без выдумок: инструменты{" "}
					<code className="text-14 text-[#f1f4ee]">list_invoices</code> и{" "}
					<code className="text-14 text-[#f1f4ee]">finance_summary</code> читают реальные счета, а{" "}
					<code className="text-14 text-[#f1f4ee]">email_report</code> собирает отчёт в PDF и отправляет его
					письмом.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Что остаётся человеку</h2>
				<p className="mb-20 text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Подтверждение, подпись, отправка и любое удаление. Дневная квота ИИ — общая для чата и
					распознавания чеков — зависит от тарифа. О том, как ассистент работает с клиентами круглосуточно,
					рассказывает{" "}
					<Link href={sitePath(locale, "/blog/2026-10-04-ai-klienty-24-7")} className="text-authBtn">
						отдельная статья
					</Link>
					.
				</p>

				<h2 className="mb-12 text-20 font-medium text-[#f1f4ee] lg:text-24">Итог</h2>
				<p className="text-16 leading-[1.7] tracking-[0.4px] text-[#8c948b] lg:text-18">
					Счёт, напоминание, выписка и расход живут в Firmspace рядом со сделкой и клиентом, а не в отдельной
					таблице. Больше о платформе — в разделе{" "}
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
