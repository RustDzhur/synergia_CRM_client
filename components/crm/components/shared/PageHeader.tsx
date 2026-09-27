"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useMessages, useTranslations } from "next-intl";
import { stripLocale } from "@/app/utils/locale";
import { currentMenuItem } from "../Sidebar/menuItems";

interface Props {
	// Крупный заголовок. Если не передан — берётся название раздела из меню по текущему адресу.
	title?: string;
	// Подпись под заголовком. Если не передана — берётся из navigation.subtitles по текущему разделу.
	subtitle?: string;
	// Метка над заголовком. По умолчанию — название группы меню (Arbeitsbereich, Betrieb, …).
	eyebrow?: string;
	// Правый край строки заголовка: счётчик, переключатель периода, кнопка.
	right?: React.ReactNode;
	// Строка под заголовком (вкладки, поиск) — на всю ширину, с тем же отступом.
	children?: React.ReactNode;
}

// Шапка страницы кабинета: метка раздела, крупный заголовок, подпись и необязательный блок справа.
// Одна на все разделы, чтобы страницы отличались содержимым, а не оформлением.
export default function PageHeader({ title, subtitle, eyebrow, right, children }: Props) {
	const tn = useTranslations("navigation");
	const messages = useMessages();
	const path = stripLocale(usePathname() ?? "");
	const item = currentMenuItem(path);

	const heading = title ?? (item ? tn(item.key) : "");
	if (!heading) return null;

	// Подписи есть не у всех разделов: у остальных строки просто не будет.
	// Сообщения читаем напрямую — в этой версии next-intl у переводчика нет проверки «ключ существует».
	const subtitles = (messages as { navigation?: { subtitles?: Record<string, string> } })?.navigation?.subtitles;
	const hint = subtitle ?? (item ? subtitles?.[item.key] ?? "" : "");

	return (
		<div className="mb-20 md:mb-26">
			<div className="flex flex-wrap items-start justify-between gap-x-20 gap-y-12">
				<div className="min-w-0">
					<p className="fs-eyebrow fs-eyebrow-dot">{eyebrow ?? (item ? tn(`groups.${item.group}`) : "")}</p>
					<h1 className="mt-12 text-28 font-semibold leading-[1.1] tracking-[-0.6px] text-[#f1f4ee] md:text-38">{heading}</h1>
					{hint && <p className="mt-8 text-14 text-[#8c948b]">{hint}</p>}
				</div>
				{right && <div className="flex shrink-0 items-center gap-10 pt-2">{right}</div>}
			</div>
			{children && <div className="mt-20 md:mt-24">{children}</div>}
		</div>
	);
}
