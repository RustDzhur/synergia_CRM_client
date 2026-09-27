"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { stripLocale } from "@/app/utils/locale";
import Collapse from "@/app/utils/Collapse";
import { isActivePath } from "../../Sidebar/menuItems";
import { useVisibleMenu } from "../../Sidebar/useVisibleMenu";

// Мобильное меню: пункт 46px, активный — салатовая рамка на лёгкой подсветке, как в сайдбаре.
const ROW = "flex items-center w-full h-46 rounded-10 border border-transparent px-12 text-left transition-colors duration-200";

export default function ModalMobNav() {
	const toggleMobileMenu = useToggleMenuState((state) => state.toggleMobileMenu);
	const items = useVisibleMenu();
	const t = useTranslations("navigation");
	const locale = useLocale();
	const path = stripLocale(usePathname());
	const [collabOpen, setCollabOpen] = useState(path.startsWith("/crm/collaboration"));

	return (
		<ul className="space-y-2 px-12 pb-[40px] pt-12">
			{items.map((item) => {
				const active = isActivePath(path, item.href);
				const Icon = item.icon;
				const color = active ? "text-[#f1f4ee]" : "text-[#cfd4cb]";
				const rowClass = `${ROW} ${active ? "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)]" : "hover:bg-[rgba(255,255,255,0.04)]"}`;
				const content = (
					<>
						<Icon size={18} className={`shrink-0 ${active ? "text-[#c6ff4d]" : "text-[#8c948b]"}`} />
						<span className={`ml-10 text-15 font-medium ${color}`}>{t(item.key)}</span>
					</>
				);

				if (item.children) {
					return (
						<li key={item.key}>
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
								<ul className="space-y-2 pt-3">
									{item.children.map((child) => (
										<li key={child.key}>
											<Link
												href={`/${locale}${child.href}`}
												onClick={toggleMobileMenu}
												className={`${ROW} h-38 pl-42 text-13 font-medium ${
													isActivePath(path, child.href) ? "text-[#c6ff4d]" : "text-[#8c948b]"
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
					<li key={item.key}>
						<Link href={`/${locale}${item.href}`} onClick={toggleMobileMenu} className={rowClass}>
							{content}
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
