"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { stripLocale } from "@/app/utils/locale";
import { menuItems, isActivePath } from "../../Sidebar/menuItems";

// Синяя плашка 55px под шапкой на телефоне: значок и название текущего раздела (Figma: Mobile).
export default function MobilePageBar() {
	const t = useTranslations("navigation");
	const path = stripLocale(usePathname());

	const item = menuItems.find((i) => isActivePath(path, i.href)) ?? menuItems[0];
	const child = item.children?.find((c) => isActivePath(path, c.href));
	const Icon = item.icon;

	return (
		<div className="md:hidden flex items-center justify-center h-[55px] bg-primaryColor">
			<Icon size={24} color="#ffffff" className="mr-10" />
			<p className="text-20 font-medium text-white tracking-[0.4px]">
				{t(child ? child.key : item.key)}
			</p>
		</div>
	);
}
