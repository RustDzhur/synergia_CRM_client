"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { stripLocale } from "@/app/utils/locale";
import Collapse from "@/app/utils/Collapse";
import { isActivePath } from "../menuItems";
import { useVisibleMenu } from "../useVisibleMenu";
import BurgerMenu from "./BurgerMenu";

// Плотный вид по образцу (не по старым размерам Figma — их сознательно уменьшили): пункт меньше и компактнее,
// шрифт заметно мельче, чем было. Активный пункт — не сплошная заливка, а тонкая салатовая рамка + мягкое свечение
// на тёмном полупрозрачном фоне (как в образце), текст остаётся светлым, а не тёмным на ярком фоне.
const ROW = "flex items-center w-full h-[40px] lg:h-[42px] px-14 text-left rounded-8 transition-[background-color,box-shadow,color,border-color] duration-200 border border-transparent";
const LABEL = "ml-8 lg:ml-10 text-13 lg:text-14 font-medium tracking-[0.2px] whitespace-nowrap transition-[opacity,color] duration-200";
const ACTIVE = "bg-[rgba(198,255,77,0.08)] border-[rgba(198,255,77,0.45)] shadow-[0_0_14px_rgba(198,255,77,0.18)]";

export default function Layout() {
	const { menu, setMenu } = useToggleMenuState();
	const items = useVisibleMenu();
	const t = useTranslations("navigation");
	const locale = useLocale();
	const path = stripLocale(usePathname());
	const [collabOpen, setCollabOpen] = useState(path.startsWith("/crm/collaboration"));

	// В макете desktop открывается с развёрнутым меню, а планшет — со свёрнутым (54px), чтобы контенту хватало места.
	// Применяем один раз при первом показе; дальше меню переключает пользователь.
	useEffect(() => {
		if (window.matchMedia("(max-width: 1439px)").matches) setMenu(false);
	}, [setMenu]);

	return (
		<nav
			className={`bg-secondaryColor shrink-0 h-full overflow-hidden pb-[60px] transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${
				menu ? "md:w-[220px] lg:w-270" : "md:w-[54px] lg:w-52"
			}`}>
			<ul>
				{items.map((item) => {
					const active = isActivePath(path, item.href);
					const Icon = item.icon;
					const color = active ? "text-white" : "text-iconColor";
					const rowClass = `${ROW} ${active ? ACTIVE : "hover:bg-gray"}`;
					const icon = <Icon size={18} className={`shrink-0 transition-colors duration-200 ${active ? "text-accentGreen" : "text-iconColor"}`} />;
					// подпись всегда в DOM: при сворачивании плавно гаснет, а обрезает её сужающийся сайдбар
					const label = (
						<span className={`${LABEL} ${color} ${menu ? "opacity-100" : "opacity-0"}`}>{t(item.key)}</span>
					);

					// Пункт с подменю (Collaboration): в развёрнутом меню раскрывает список,
					// в свёрнутом (только иконки) ведёт на первую страницу раздела.
					if (item.children) {
						return (
							<li key={item.key} className="mb-4">
								{menu ? (
									<button
										type="button"
										aria-expanded={collabOpen}
										onClick={() => setCollabOpen(!collabOpen)}
										className={rowClass}>
										{icon}
										{label}
										<MdKeyboardArrowDown
											size={24}
											className={`ml-16 shrink-0 transition-[transform,color] duration-300 ${color} ${
												collabOpen ? "rotate-180" : ""
											}`}
										/>
									</button>
								) : (
									<Link href={`/${locale}${item.children[0].href}`} className={rowClass}>
										{icon}
									</Link>
								)}
								<Collapse open={menu && collabOpen}>
									<ul className="pt-6">
										{item.children.map((child) => (
											<li key={child.key} className="mb-4">
												<Link
													href={`/${locale}${child.href}`}
													className={`${ROW} text-13 lg:text-14 font-medium tracking-[0.2px] whitespace-nowrap hover:bg-gray ${
														isActivePath(path, child.href)
															? "text-primaryColor"
															: "text-[#999999]"
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
						<li key={item.key} className="mb-4">
							<Link href={`/${locale}${item.href}`} className={rowClass}>
								{icon}
								{label}
							</Link>
						</li>
					);
				})}
				{/* На desktop бургер в шапке (см. Header), на tablet его нет в шапке — оставляем здесь */}
				<li className="hidden md:block lg:hidden px-16 py-16">
					<BurgerMenu size={20} />
				</li>
			</ul>
		</nav>
	);
}
