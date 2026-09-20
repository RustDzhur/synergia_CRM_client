"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { stripLocale } from "@/app/utils/locale";
import Collapse from "@/app/utils/Collapse";
import { menuItems, isActivePath } from "../../Sidebar/menuItems";

// Мобильное меню (Figma 375px): пункт 55px, шаг 66px, текст 20px, активный — синяя полоса.
const ROW = "flex items-center w-full h-[55px] px-12 text-left transition-colors duration-200";

export default function ModalMobNav() {
	const toggleMobileMenu = useToggleMenuState((state) => state.toggleMobileMenu);
	const t = useTranslations("navigation");
	const locale = useLocale();
	const path = stripLocale(usePathname());
	const [collabOpen, setCollabOpen] = useState(path.startsWith("/crm/collaboration"));

	return (
		<ul className="pt-0">
			{menuItems.map((item) => {
				const active = isActivePath(path, item.href);
				const Icon = item.icon;
				const color = active ? "text-white" : "text-iconColor";
				const rowClass = `${ROW} ${active ? "bg-primaryColor" : ""}`;
				const content = (
					<>
						<Icon size={20} className={`shrink-0 ${color}`} />
						<span className={`ml-10 text-20 font-medium tracking-[0.4px] ${color}`}>{t(item.key)}</span>
					</>
				);

				if (item.children) {
					return (
						<li key={item.key} className="mb-[11px]">
							<button
								type="button"
								aria-expanded={collabOpen}
								onClick={() => setCollabOpen(!collabOpen)}
								className={rowClass}>
								{content}
								<MdKeyboardArrowDown
									size={24}
									className={`ml-16 transition-[transform,color] duration-300 ${color} ${
										collabOpen ? "rotate-180" : ""
									}`}
								/>
							</button>
							<Collapse open={collabOpen}>
								<ul className="pt-[11px]">
									{item.children.map((child) => (
										<li key={child.key} className="mb-[11px]">
											<Link
												href={`/${locale}${child.href}`}
												onClick={toggleMobileMenu}
												className={`${ROW} text-20 font-medium tracking-[0.4px] ${
													isActivePath(path, child.href) ? "text-primaryColor" : "text-[#999999]"
												}`}>
												{t(child.key)}
											</Link>
										</li>
									))}
								</ul>
							</Collapse>
						</li>
					);
				}

				return (
					<li key={item.key} className="mb-[11px]">
						<Link href={`/${locale}${item.href}`} onClick={toggleMobileMenu} className={rowClass}>
							{content}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
