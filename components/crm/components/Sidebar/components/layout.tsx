"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useToggleMenuState } from "@/app/store/useToggleMenuState";
import {
	BsFillHouseFill, BsFillPeopleFill, BsBarChartSteps, BsCardChecklist,
	BsFillHandbagFill, BsDiagram3, BsRocketTakeoffFill, BsPersonLinesFill,
} from "react-icons/bs";
import { GiProgression } from "react-icons/gi";
import { SiIcinga } from "react-icons/si";
import { FiSettings } from "react-icons/fi";
import { IconContext } from "react-icons";
import BurgerMenu from "./BurgerMenu";

export default function Layout() {
	const { menu } = useToggleMenuState();
	const t = useTranslations("navigation");
	const locale = useLocale();
	const pathname = usePathname();

	const menuItems = [
		{ icon: BsFillHouseFill, text: t("dashboard"), href: `/${locale}/crm` },
		{ icon: BsFillPeopleFill, text: t("collaboration"), href: `/${locale}/crm/collaboration` },
		{ icon: GiProgression, text: t("company"), href: `/${locale}/crm/company` },
		{ icon: BsBarChartSteps, text: t("crm"), href: `/${locale}/crm/crm` },
		{ icon: BsPersonLinesFill, text: t("contacts"), href: `/${locale}/crm/contacts` },
		{ icon: BsCardChecklist, text: t("tasks_projects"), href: `/${locale}/crm/tasks` },
		{ icon: SiIcinga, text: t("inventory_management"), href: `/${locale}/crm/inventory` },
		{ icon: BsFillHandbagFill, text: t("marketing"), href: `/${locale}/crm/marketing` },
		{ icon: BsDiagram3, text: t("automation"), href: `/${locale}/crm/automation` },
		{ icon: BsRocketTakeoffFill, text: t("upgrade_plan"), href: `/${locale}/crm/upgrade` },
		{ icon: FiSettings, text: t("settings"), href: `/${locale}/crm/settings` },
	];

	return (
		<div className={`${!menu && "flex-col items-left inline-block"} bg-secondaryColor h-[100vh] inline-block`}>
			<IconContext.Provider value={{ color: "#B3B3B3" }}>
				<ul>
					{menuItems.map((item) => {
						const active = item.href === `/${locale}/crm` ? pathname === item.href : pathname.startsWith(item.href);
						return (
							<li key={item.href} className={`${active ? "bg-primaryColor" : ""} p-16 flex items-center cursor-pointer`}>
								<Link href={item.href} className="flex items-center w-full">
									<item.icon style={{ color: active ? "white" : "#B3B3B3", marginRight: menu ? "10px" : "", width: 20, height: 27 }} />
									{menu && <p className={`text-14 mp:text-18 ${active ? "text-white" : "text-iconColor"} font-medium`}>{item.text}</p>}
								</Link>
							</li>
						);
					})}
					<li className="hidden p-16 md:block"><BurgerMenu /></li>
				</ul>
			</IconContext.Provider>
		</div>
	);
}