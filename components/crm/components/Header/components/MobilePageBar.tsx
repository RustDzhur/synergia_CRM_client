"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useToggleMenuState } from "@/store/useToggleMenuState";
import { stripLocale } from "@/utils/locale";
import { menuItems, isActivePath } from "../../Sidebar/menuItems";

// Плашка 46px под шапкой на телефоне: значок и название текущего раздела.
// У Collaboration рядом стрелка: плашка открывает меню с подразделами (Feed, Chat And Calls ...),
// а название подраздела показывает сама страница.
export default function MobilePageBar() {
	const t = useTranslations("navigation");
	const path = stripLocale(usePathname());
	const toggleMobileMenu = useToggleMenuState((state) => state.toggleMobileMenu);

	const item = menuItems.find((i) => isActivePath(path, i.href)) ?? menuItems[0];
	const Icon = item.icon;
	const content = (
		<>
			<Icon size={17} color="#c6ff4d" className="mr-10" />
			<p className="text-14 font-medium text-[#f1f4ee]">{t(item.key)}</p>
			{item.children && <MdKeyboardArrowDown size={18} color="#8c948b" className="ml-10" />}
		</>
	);
	const bar = "md:hidden flex items-center justify-center h-46 w-full border-b border-inkLine bg-inkDeep";

	return item.children ? (
		<button type="button" onClick={toggleMobileMenu} className={bar}>{content}</button>
	) : (
		<div className={bar}>{content}</div>
	);
}
