"use client";
import React from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { ABOUT } from "@/app/content/aboutPage";
import { tx } from "@/app/content/i18n";
import aboutPhoto from "@/app/assets/images/aboutUs.jpg";
import PageShell from "../PageShell";
import HeroAppFrame from "../MainPage/Hero/HeroAppFrame";

// About us: рассказ о том, что за продукт, для кого он и по каким правилам сделан. Раньше здесь стоял
// текст-заглушка (Lorem ipsum) без оформления — на тёмной странице он ещё и был нечитаемым.
export default function AboutUs() {
	const locale = useLocale();
	return (
		<PageShell title={tx(ABOUT.title, locale)} intro={tx(ABOUT.intro, locale)}>
			<div className="grid items-start gap-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-[48px]">
				<div className="flex flex-col gap-16 text-15 leading-[1.75] text-[#cfd4cb]">
					{ABOUT.paragraphs.map((p, i) => (
						<p key={i}>{tx(p, locale)}</p>
					))}
				</div>
				<div className="overflow-hidden rounded-16 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)]">
					<Image src={aboutPhoto} alt={tx(ABOUT.photoAlt, locale)} className="h-full w-full object-cover" priority />
				</div>
			</div>

			{/* Принципы: по одной мысли в карточке — читается быстрее, чем абзац текста */}
			<div className="mt-40 grid gap-12 sm:grid-cols-2 lg:mt-[56px] lg:grid-cols-4">
				{ABOUT.points.map((p, i) => (
					<div key={i} className="rounded-14 border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] p-16">
						<p className="text-14 font-medium text-[#c6ff4d]">{tx(p.title, locale)}</p>
						<p className="mt-8 text-13 leading-[1.6] text-[#8c948b]">{tx(p.text, locale)}</p>
					</div>
				))}
			</div>

			{/* Как выглядит кабинет: рамка собрана разметкой и повторяет настоящий интерфейс,
			    поэтому такая «картинка» не устаревает после каждого обновления */}
			<div className="mt-40 lg:mt-[56px]">
				<p className="mb-12 text-13 text-[#8c948b]">{tx(ABOUT.screenshotHint, locale)}</p>
				<div className="overflow-hidden rounded-16 border border-[rgba(255,255,255,0.10)] bg-[#131715] p-10 md:p-16">
					<HeroAppFrame screen="overview" />
				</div>
			</div>
		</PageShell>
	);
}
