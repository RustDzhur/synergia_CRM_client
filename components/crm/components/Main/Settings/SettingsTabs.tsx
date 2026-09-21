"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdNotificationAdd, MdOutlineAccountCircle, MdOutlineHexagon, MdGroups, MdPeopleAlt } from "react-icons/md";
import { stripLocale } from "@/app/utils/locale";

export const SETTINGS_TABS = [
	{ key: "tabAccount", href: "/crm/settings", icon: MdOutlineAccountCircle },
	{ key: "tabNotifications", href: "/crm/settings/notifications", icon: MdNotificationAdd },
	{ key: "tabIntegration", href: "/crm/settings/integration", icon: MdOutlineHexagon },
	{ key: "tabColleagues", href: "/crm/settings/colleagues", icon: MdPeopleAlt },
	{ key: "tabTeam", href: "/crm/settings/team", icon: MdGroups },
] as const;

// Карточка со вкладками Settings: Account / Notifications / Integration / Colleagues.
// Каждая вкладка — отдельный маршрут (/crm/settings, /crm/settings/notifications ...), поэтому на неё можно дать ссылку.
// Ширина 202px на планшете и десктопе, на телефоне — во всю ширину (Figma).
export default function SettingsTabs({ className = "" }: { className?: string }) {
	const t = useTranslations("settings");
	const locale = useLocale();
	const path = stripLocale(usePathname()).replace(/\/$/, "");

	return (
		<nav aria-label={t("navLabel")} className={`rounded-16 bg-white px-20 shadow-heroImage md:w-auto md:min-w-[202px] md:max-w-[280px] ${className}`}>
			<ul>
				{SETTINGS_TABS.map(({ key, href, icon: Icon }, i) => {
					const active = path === href;
					return (
						<li key={key} className={i > 0 ? "border-t border-[#E6E6E6]" : ""}>
							<Link
								href={`/${locale}${href}`}
								aria-current={active ? "page" : undefined}
								className={`flex h-[70px] items-center gap-12 text-16 font-medium transition-colors duration-200 md:text-18 ${
									active ? "text-primaryColor" : "text-iconColor hover:text-[#808080]"
								}`}>
								<Icon size={28} className="shrink-0" />
								<span className="truncate" title={t(key)}>{t(key)}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
