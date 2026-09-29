"use client";
import "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { stripLocale } from "@/utils/locale";
import { currentMenuItem } from "../../Sidebar/menuItems";
import { useVisibleMenu } from "../../Sidebar/useVisibleMenu";

// Хлебные крошки в шапке: «Arbeitsbereich / Übersicht» — группа меню слева, текущий раздел справа.
// Подраздел (Feed, Kalender, …) добавляется третьим звеном, если открыт не корень раздела.
export default function Breadcrumb() {
	const t = useTranslations("navigation");
	const path = stripLocale(usePathname() ?? "");
	const items = useVisibleMenu();
	const item = currentMenuItem(path);

	if (!item) return null;

	// Подпись подраздела берём из вложенных пунктов: у Collaboration они свои,
	// у остальных разделов вложенных нет и крошки остаются из двух звеньев.
	const child = item.children?.find((c) => path === c.href || path.startsWith(`${c.href}/`));
	const inMenu = items.some((i) => i.key === item.key);

	return (
		<nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-8 text-13">
			{inMenu && (
				<>
					<span className="truncate text-[#8c948b]">{t(`groups.${item.group}`)}</span>
					<span className="shrink-0 text-[#7E867C]" aria-hidden>
						/
					</span>
				</>
			)}
			<span className={`truncate font-medium ${child ? "text-[#8c948b]" : "text-[#f1f4ee]"}`}>{t(item.key)}</span>
			{child && (
				<>
					<span className="shrink-0 text-[#7E867C]" aria-hidden>
						/
					</span>
					<span className="truncate font-medium text-[#f1f4ee]">{t(child.key)}</span>
				</>
			)}
		</nav>
	);
}
