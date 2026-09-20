"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { stripLocale } from "@/app/utils/locale";
import { menuItems, isActivePath } from "../../Sidebar/menuItems";

// Синяя плашка 55px под шапкой на телефоне: значок и название текущего раздела (Figma: Mobile).
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
			<Icon size={24} color="#ffffff" className="mr-10" />
			<p className="text-20 font-medium text-white tracking-[0.4px]">{t(item.key)}</p>
			{item.children && <MdKeyboardArrowDown size={24} color="#ffffff" className="ml-10" />}
		</>
	);
	const bar = "md:hidden flex items-center justify-center h-[55px] w-full bg-primaryColor";

	return item.children ? (
		<button type="button" onClick={toggleMobileMenu} className={bar}>{content}</button>
	) : (
		<div className={bar}>{content}</div>
	);
}
