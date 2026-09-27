import type { IconType } from "react-icons";
import type { FeatureKey } from "@/app/config/plans";
import {
	MdHome,
	MdTask,
	MdMail,
	MdAccountBox,
	MdChat,
	MdOutlineShoppingBag,
	MdAssessment,
	MdKeyboardDoubleArrowUp,
	MdSettingsSuggest,
	MdAccountBalance,
} from "react-icons/md";

export interface SubMenuItem {
	key: string; // ключ перевода в messages -> navigation
	href: string; // путь без префикса языка
	feature?: FeatureKey; // раздел тарифа (app/config/plans.ts); без него пункт виден всем
}

export interface MenuItem {
	key: string;
	module?: string; // раздел доступа (lib/access.ts); без него пункт виден всем
	feature?: FeatureKey; // раздел тарифа (app/config/plans.ts): чего нет в тарифе фирмы, того нет и в меню
	icon: IconType;
	href: string;
	children?: SubMenuItem[];
}

// Единый список пунктов меню для сайдбара (desktop/tablet) и мобильного меню.
// Порядок и состав — как в Figma: Contacts здесь нет, это вкладка внутри CRM.
export const menuItems: MenuItem[] = [
	{ key: "dashboard", icon: MdHome, href: "/crm" },
	{
		key: "collaboration",
		module: "collab",
		icon: MdTask,
		href: "/crm/collaboration",
		// у пункта с вложенными разделы берутся у вложенных: он виден, пока виден хотя бы один из них
		children: [
			{ key: "feed", href: "/crm/collaboration/feed", feature: "collab" },
			{ key: "chat_and_calls", href: "/crm/collaboration/chat-and-calls", feature: "channels" },
			{ key: "calendar", href: "/crm/collaboration/calendar", feature: "collab" },
			{ key: "online_documents", href: "/crm/collaboration/online-documents", feature: "documents" },
			{ key: "web_mails", href: "/crm/collaboration/web-mails", feature: "mail" },
		],
	},
	{ key: "company", icon: MdMail, href: "/crm/company", feature: "company", module: "company" },
	{ key: "crm", icon: MdAccountBox, href: "/crm/crm", feature: "crm", module: "crm" },
	{ key: "tasks_projects", icon: MdChat, href: "/crm/tasks", feature: "tasks", module: "tasks" },
	{ key: "inventory_management", icon: MdAccountBalance, href: "/crm/inventory", feature: "inventory", module: "inventory" },
	{ key: "marketing", icon: MdOutlineShoppingBag, href: "/crm/marketing", feature: "marketing", module: "marketing" },
	{ key: "automation", icon: MdAssessment, href: "/crm/automation", feature: "automation", module: "automation" },
	{ key: "upgrade_plan", icon: MdKeyboardDoubleArrowUp, href: "/crm/upgrade", module: "billing" },
	{ key: "settings", icon: MdSettingsSuggest, href: "/crm/settings", module: "settings" },
];

// `path` — уже без префикса языка (см. stripLocale).
export function isActivePath(path: string, href: string): boolean {
	if (href === "/crm") return path === "/crm";
	return path === href || path.startsWith(`${href}/`);
}
