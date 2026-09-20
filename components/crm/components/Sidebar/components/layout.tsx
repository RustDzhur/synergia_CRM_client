"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdKeyboardArrowDown } from "react-icons/md";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import { stripLocale } from "@/app/utils/locale";
import Collapse from "@/app/utils/Collapse";
import { menuItems, isActivePath } from "../menuItems";
import BurgerMenu from "./BurgerMenu";

// Размеры из Figma:
//  desktop (lg):  развёрнут 270px / свёрнут 52px, пункт 54px, шаг 60px, текст 18px
//  tablet  (md):  развёрнут 220px / свёрнут 54px, пункт 50px, шаг 56px, текст 15px
const ROW = "flex items-center w-full h-[50px] lg:h-[54px] px-16 text-left transition-colors duration-200";
const LABEL = "ml-6 lg:ml-10 text-15 lg:text-18 font-medium tracking-[0.3px] whitespace-nowrap transition-[opacity,color] duration-200";

export default function Layout() {
	const { menu, setMenu } = useToggleMenuState();
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
			className={`bg-secondaryColor shrink-0 h-full overflow-hidden transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${
				menu ? "md:w-[220px] lg:w-270" : "md:w-[54px] lg:w-52"
			}`}>
			<ul>
				{menuItems.map((item) => {
					const active = isActivePath(path, item.href);
					const Icon = item.icon;
					const color = active ? "text-white" : "text-iconColor";
					const rowClass = `${ROW} ${active ? "bg-primaryColor" : "hover:bg-gray"}`;
					const icon = <Icon size={20} className={`shrink-0 transition-colors duration-200 ${color}`} />;
					// подпись всегда в DOM: при сворачивании плавно гаснет, а обрезает её сужающийся сайдбар
					const label = (
						<span className={`${LABEL} ${color} ${menu ? "opacity-100" : "opacity-0"}`}>{t(item.key)}</span>
					);

					// Пункт с подменю (Collaboration): в развёрнутом меню раскрывает список,
					// в свёрнутом (только иконки) ведёт на первую страницу раздела.
					if (item.children) {
						return (
							<li key={item.key} className="mb-6">
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
											<li key={child.key} className="mb-6">
												<Link
													href={`/${locale}${child.href}`}
													className={`${ROW} text-15 lg:text-18 font-medium tracking-[0.3px] whitespace-nowrap hover:bg-gray ${
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
						<li key={item.key} className="mb-6">
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
