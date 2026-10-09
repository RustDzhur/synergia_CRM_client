"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TbBellPlus, TbBriefcase, TbFileText, TbGavel, TbHexagon, TbUserCircle, TbUsers, TbUsersGroup } from "react-icons/tb";
import { stripLocale } from "@/utils/locale";

export const SETTINGS_TABS = [
	{ key: "tabAccount", href: "/crm/settings", icon: TbUserCircle },
	{ key: "tabNotifications", href: "/crm/settings/notifications", icon: TbBellPlus },
	{ key: "tabIntegration", href: "/crm/settings/integration", icon: TbHexagon },
	{ key: "tabColleagues", href: "/crm/settings/colleagues", icon: TbUsers },
	{ key: "tabTeam", href: "/crm/settings/team", icon: TbUsersGroup },
	{ key: "tabPractice", href: "/crm/settings/practice", icon: TbBriefcase },
	{ key: "tabLegal", href: "/crm/settings/legal", icon: TbGavel },
	{ key: "tabContractTemplates", href: "/crm/settings/contracts", icon: TbFileText },
] as const;

// Карточка со вкладками Settings: Account / Notifications / Integration / Colleagues.
// Каждая вкладка — отдельный маршрут (/crm/settings, /crm/settings/notifications ...), поэтому на неё можно дать ссылку.
// Ширина 202px на планшете и десктопе, на телефоне — во всю ширину (Figma).
export default function SettingsTabs({ className = "" }: { className?: string }) {
	const t = useTranslations("settings");
	const locale = useLocale();
	const path = stripLocale(usePathname()).replace(/\/$/, "");

	return (
		<nav aria-label={t("navLabel")} className={`fs-card px-8 py-8 md:w-auto md:min-w-[202px] md:max-w-[280px] ${className}`}>
			<ul>
				{SETTINGS_TABS.map(({ key, href, icon: Icon }, i) => {
					const active = path === href;
					return (
						<li key={key} className={i > 0 ? "border-t border-inkLineSoft" : ""}>
							<Link
								href={`/${locale}${href}`}
								aria-current={active ? "page" : undefined}
								className={`flex h-44 items-center gap-10 rounded-10 px-10 text-13 font-medium transition-colors duration-150 ${
									active ? "bg-[rgba(198,255,77,0.08)] text-[#c6ff4d]" : "text-[#8c948b] hover:text-[#f1f4ee]"
								}`}>
								<Icon size={18} className="shrink-0" />
								<span className="truncate" title={t(key)}>{t(key)}</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
