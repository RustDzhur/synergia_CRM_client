"use client";
import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { tx } from "@/content/i18n";
import { DOCS } from "@/content/footerPages";
import { menuItems } from "@/components/crm/components/Sidebar/menuItems";
import PageShell from "../PageShell";
import HeroAppFrame, { type FrameScreen } from "../MainPage/Hero/HeroAppFrame";

// Какой кадр интерфейса показывать у раздела. Кадр собран разметкой и повторяет настоящий кабинет,
// поэтому «снимок» не устаревает после обновления. Разделы без кадра идут просто текстом.
const FRAME: Record<string, FrameScreen> = {
	start: "overview",
	crm: "crm",
	collaboration: "chat",
	finance: "finance",
};

// Раздел документации может быть написан под другим идентификатором, чем ключ пункта меню: у части
// разделов идентификатор остался от прежнего названия пункта (он уже стоит в адресах-якорях ссылок,
// поэтому менять его нельзя). Таблица связывает такие пары, иначе раздел в списке двоится.
const DOC_SECTION_OF_MENU: Record<string, string> = {
	tasks_projects: "tasks",           // «Aufgaben und Projekte» в меню — раздел «Aufgaben und Kalender»
	inventory_management: "finance",   // пункт меню называется «Finanzen», раздел — «Finanzen: Angebote…»
	upgrade_plan: "billing",           // «Aktualisieren Sie Ihren Plan» — раздел «Tarife und Abrechnung»
};

// Documentation: слева оглавление (ссылки-якоря), справа разделы с пронумерованными шагами и кадром интерфейса.
//
// Разделы, для которых текст ещё не написан, берутся из самой навигации кабинета (menuItems.ts):
// новый раздел появляется в документации сразу, а не после правки этой страницы.
export default function Documentation() {
	const locale = useLocale();
	const t = useTranslations("navigation");
	const written = new Set(DOCS.sections.map((s) => s.id));
	// у группы («Zusammenarbeit») разделом считается не она сама, а вложенные; остальное — само по себе.
	// Так новый пункт меню появляется в документации сразу, даже если текст для него ещё не написан
	const navigated = menuItems.flatMap((item) => (item.children ? item.children : [item]));
	const auto = navigated.filter((item) => !written.has(DOC_SECTION_OF_MENU[item.key] ?? item.key));

	return (
		<PageShell title={tx(DOCS.title, locale)} intro={tx(DOCS.intro, locale)}>
			<div className="flex flex-col gap-30 lg:flex-row lg:gap-[60px]">
				<nav aria-label={tx(DOCS.title, locale)} className="lg:sticky lg:top-[20px] lg:w-[260px] lg:shrink-0 lg:self-start">
					<ul className="space-y-4 rounded-16 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] p-16">
						{DOCS.sections.map((s) => (
							<li key={s.id}>
								<a href={`#${s.id}`} className="block rounded-8 px-12 py-8 text-16 tracking-[0.3px] text-[#f1f4ee] transition-colors hover:bg-[rgba(198,255,77,0.10)] hover:text-[#c6ff4d]">
									{tx(s.title, locale)}
								</a>
							</li>
						))}
						{auto.map((item) => (
							<li key={item.key}>
								<a href={`#${item.key}`} className="block rounded-8 px-12 py-8 text-16 tracking-[0.3px] text-[#8c948b] transition-colors hover:bg-[rgba(198,255,77,0.10)] hover:text-[#c6ff4d]">
									{t(item.key)}
								</a>
							</li>
						))}
					</ul>
				</nav>
				<div className="min-w-0 flex-1">
					{DOCS.sections.map((s) => (
						<section key={s.id} id={s.id} className="mb-[50px] scroll-mt-[20px]">
							<h2 className="mb-16 text-24 font-medium text-[#f1f4ee]">{tx(s.title, locale)}</h2>
							{FRAME[s.id] && (
								<div className="mb-20 overflow-hidden rounded-16 border border-[rgba(255,255,255,0.10)] bg-[#131715] p-8 md:p-12">
									<HeroAppFrame screen={FRAME[s.id]} />
								</div>
							)}
							<ol className="space-y-12">
								{s.steps.map((step, i) => (
									<li key={i} className="flex gap-12 text-16 leading-[1.7] tracking-[0.3px] text-[#f1f4ee] lg:text-18">
										<span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[50%] bg-[#c6ff4d] text-14 font-medium text-[#0A0A0A]">{i + 1}</span>
										<span>{tx(step, locale)}</span>
									</li>
								))}
							</ol>
						</section>
					))}

					{/* Разделы, текст для которых ещё пишется: список ведёт себя как остальные, чтобы
					    ссылки из оглавления не пропадали, когда раздел появился в кабинете */}
					{auto.map((item) => (
						<section key={item.key} id={item.key} className="mb-[50px] scroll-mt-[20px]">
							<h2 className="mb-12 text-24 font-medium text-[#f1f4ee]">{t(item.key)}</h2>
							<p className="text-16 leading-[1.7] text-[#8c948b]">{tx(DOCS.soon, locale)}</p>
						</section>
					))}
				</div>
			</div>
		</PageShell>
	);
}
