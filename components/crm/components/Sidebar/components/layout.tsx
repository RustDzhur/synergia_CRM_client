"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TbChevronDown, TbLayoutSidebarLeftCollapse, TbShieldLock } from "react-icons/tb";
import { useToggleMenuState } from "@/store/useToggleMenuState";
import { useNotificationStore } from "@/store/useNotificationStore";
import { stripLocale } from "@/utils/locale";
import Collapse from "@/utils/Collapse";
import { isActivePath, type MenuGroup, type MenuItem, type SubMenuItem } from "../menuItems";
import { useVisibleMenu } from "../useVisibleMenu";
import BrandMark from "@/components/crm/components/shared/BrandMark";
import OrgSwitcher from "./OrgSwitcher";
import SidebarUser from "./SidebarUser";

// Пункт меню: строка 40px, скругление 10px, иконка 17px и подпись 13.5px.
// Активный пункт не заливается акцентом, а обводится салатовой рамкой на лёгкой подсветке —
// так он читается и не спорит с остальными пунктами.
const ROW =
	"flex items-center w-full h-40 rounded-10 border border-transparent text-left transition-[background-color,border-color,color] duration-150";
const ROW_FULL = `${ROW} gap-12 px-12`;
const ROW_ICON = `${ROW} justify-center`;
const ACTIVE = "border-[rgba(198,255,77,0.55)] bg-[rgba(198,255,77,0.10)]";

// Подраздел (Feed, Kalender, …) — та же строка, но с отступом под иконку родителя.
const SUB_ROW = `${ROW} h-34 pl-42 pr-12 text-13`;

export default function Layout() {
	const { menu, setMenu, toggleMenu } = useToggleMenuState();
	const items = useVisibleMenu();
	const t = useTranslations("navigation");
	// подписи карточки защищённой области лежат в navBar — там же, где остальные подписи каркаса
	const tn = useTranslations("navBar");
	const locale = useLocale();
	const path = stripLocale(usePathname());
	const [collabOpen, setCollabOpen] = useState(path.startsWith("/crm/collaboration"));
	const notifItems = useNotificationStore((s) => s.items);

	// В макете desktop открывается с развёрнутым меню, а планшет — со свёрнутым, чтобы контенту хватало места.
	// Применяем один раз при первом показе; дальше меню переключает пользователь.
	useEffect(() => {
		if (window.matchMedia("(max-width: 1439px)").matches) setMenu(false);
	}, [setMenu]);

	// Пункты собраны в группы, у каждой — свой заголовок. Соседние пункты одной группы идут подряд,
	// поэтому достаточно пройти список один раз и вставить заголовок при смене группы.
	const groups = useMemo(() => {
		const out: { key: MenuGroup; items: MenuItem[] }[] = [];
		for (const item of items) {
			const last = out[out.length - 1];
			if (last && last.key === item.group) last.items.push(item);
			else out.push({ key: item.group, items: [item] });
		}
		return out;
	}, [items]);

	// Точка у пункта — есть непрочитанное, которое ведёт в этот раздел. Ничего не запрашиваем:
	// список уведомлений и так опрашивается центром уведомлений в каркасе кабинета.
	const hasUnread = (href: string) =>
		notifItems.some((n) => !n.read && (n.link === href || n.link.startsWith(`${href}/`)));

	const renderChild = (child: SubMenuItem) => {
		const active = isActivePath(path, child.href);
		return (
			<li key={child.key}>
				<Link href={`/${locale}${child.href}`} className={`${SUB_ROW} ${active ? "text-[#c6ff4d]" : "text-[#8c948b] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#e6eae2]"}`}>
					{t(child.key)}
				</Link>
			</li>
		);
	};

	return (
		<aside
			className={`hidden md:flex sticky top-0 h-screen shrink-0 flex-col border-r border-inkLine bg-inkDeep transition-[width] duration-300 ease-in-out motion-reduce:transition-none ${
				menu ? "w-248 lg:w-272" : "w-68"
			}`}>
			{/* Логотип и сворачивание меню */}
			<div className={`flex h-68 shrink-0 items-center ${menu ? "gap-10 px-16" : "justify-center px-12"}`}>
				<Link
					href={`/${locale}/crm`}
					aria-label="Firmspace AI"
					// Находясь уже в кабинете, нажатие на знак открывало ту же страницу заново: браузер
					// при этом никуда не прокручивает, и страница оставалась на прежнем месте
					onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
					className="flex min-w-0 items-center gap-10">
					<BrandMark />
					{menu && (
						<span className="truncate text-15 font-semibold tracking-[-0.2px] text-[#f1f4ee]">
							Firmspace <span className="text-[#c6ff4d]">AI</span>
						</span>
					)}
				</Link>
				{menu && (
					<button
						type="button"
						aria-label="Toggle menu"
						onClick={toggleMenu}
						className="ml-auto flex h-28 w-28 shrink-0 items-center justify-center rounded-7 text-[#8c948b] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#f1f4ee]">
						<TbLayoutSidebarLeftCollapse size={18} />
					</button>
				)}
			</div>

			{/* Свёрнутое меню: развернуть можно только этой кнопкой — в строке логотипа она не помещается */}
			{!menu && (
				<button
					type="button"
					aria-label="Toggle menu"
					onClick={toggleMenu}
					className="mx-auto mb-6 flex h-28 w-28 shrink-0 items-center justify-center rounded-7 text-[#8c948b] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#f1f4ee]">
					<TbLayoutSidebarLeftCollapse size={18} className="rotate-180" />
				</button>
			)}

			{/* Активная организация */}
			<div className="shrink-0 px-12">
				<OrgSwitcher collapsed={!menu} />
			</div>

			{/* Разделы кабинета */}
			<nav className="fs-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-12 pb-16 pt-6">
				{groups.map((group) => (
					<div key={group.key}>
						{menu && <p className="fs-nav-group px-12 pb-8 pt-22">{t(`groups.${group.key}`)}</p>}
						{!menu && <div className="pb-10 pt-14" />}
						<ul className="space-y-3">
							{group.items.map((item) => {
								const active = isActivePath(path, item.href);
								const Icon = item.icon;
								const dot = hasUnread(item.href);
								const iconEl = (
									<Icon
										size={17}
										className={`shrink-0 transition-colors duration-150 ${active ? "text-[#c6ff4d]" : "text-[#8c948b] group-hover/item:text-[#e6eae2]"}`}
									/>
								);

								// Пункт с подменю (Collaboration): в развёрнутом меню раскрывает список,
								// в свёрнутом (только иконки) ведёт на первую страницу раздела.
								if (item.children) {
									return (
										<li key={item.key}>
											{menu ? (
												<button
													type="button"
													aria-expanded={collabOpen}
													onClick={() => setCollabOpen(!collabOpen)}
													className={`group/item ${ROW_FULL} ${
														active
															? ACTIVE
															: "text-[#cfd4cb] hover:bg-[rgba(255,255,255,0.04)]"
													}`}>
													{iconEl}
													<span className={`min-w-0 flex-1 truncate text-13 font-medium ${active ? "text-[#f1f4ee]" : ""}`}>{t(item.key)}</span>
													{dot && <span className="h-5 w-5 shrink-0 rounded-50 bg-[#c6ff4d]" aria-hidden />}
													<TbChevronDown
														size={15}
														className={`shrink-0 text-[#8c948b] transition-transform duration-200 ${collabOpen ? "rotate-180" : ""}`}
													/>
												</button>
											) : (
												<Link
													href={`/${locale}${item.children[0].href}`}
													aria-label={t(item.key)}
													className={`group/item ${ROW_ICON} ${active ? ACTIVE : "hover:bg-[rgba(255,255,255,0.04)]"}`}>
													{iconEl}
												</Link>
											)}
											{menu && (
												<Collapse open={collabOpen}>
													<ul className="space-y-2 pt-3">{item.children.map(renderChild)}</ul>
												</Collapse>
											)}
										</li>
									);
								}

								return (
									<li key={item.key}>
										<Link
											href={`/${locale}${item.href}`}
											aria-label={menu ? undefined : t(item.key)}
											className={`group/item ${menu ? ROW_FULL : ROW_ICON} ${active ? ACTIVE : "hover:bg-[rgba(255,255,255,0.04)]"}`}>
											{iconEl}
											{menu && (
												<>
													<span className={`min-w-0 flex-1 truncate text-13 font-medium ${active ? "text-[#f1f4ee]" : "text-[#cfd4cb]"}`}>{t(item.key)}</span>
													{dot && <span className="h-5 w-5 shrink-0 rounded-50 bg-[#c6ff4d]" aria-hidden />}
												</>
											)}
										</Link>
									</li>
								);
							})}
						</ul>
					</div>
				))}
			</nav>

			{/* Защищённая область и пользователь */}
			<div className="shrink-0 border-t border-inkLineSoft px-12 pb-12 pt-12">
				{menu ? (
					<div className="fs-card mb-10 flex items-center gap-10 p-10">
						<span className="fs-icon-tile h-30 w-30 shrink-0">
							<TbShieldLock size={16} />
						</span>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-12 font-semibold text-[#e6eae2]">{tn("protectedArea")}</span>
							<span className="mt-2 block truncate text-10 text-[#9AA396]">{tn("protectedAreaHint")}</span>
						</span>
					</div>
				) : (
					<div className="mb-10 flex justify-center" title={tn("protectedArea")}>
						<span className="fs-icon-tile h-30 w-30">
							<TbShieldLock size={16} />
						</span>
					</div>
				)}
				<SidebarUser collapsed={!menu} />
			</div>
		</aside>
	);
}
