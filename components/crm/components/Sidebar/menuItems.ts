import type { IconType } from "react-icons";
import {
	MdHome,
	MdTask,
	MdMail,
	MdAccountBox,
	MdChat,
	MdViewHeadline,
	MdOutlineShoppingBag,
	MdAssessment,
	MdKeyboardDoubleArrowUp,
	MdSettingsSuggest,
} from "react-icons/md";

export interface SubMenuItem {
	key: string; // ключ перевода в messages -> navigation
	href: string; // путь без префикса языка
}

export interface MenuItem {
	key: string;
	module?: string; // раздел доступа (lib/access.ts); без него пункт виден всем
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
		children: [
			{ key: "feed", href: "/crm/collaboration/feed" },
			{ key: "chat_and_calls", href: "/crm/collaboration/chat-and-calls" },
			{ key: "calendar", href: "/crm/collaboration/calendar" },
			{ key: "online_documents", href: "/crm/collaboration/online-documents" },
			{ key: "web_mails", href: "/crm/collaboration/web-mails" },
		],
	},
	{ key: "company", icon: MdMail, href: "/crm/company", module: "company" },
	{ key: "crm", icon: MdAccountBox, href: "/crm/crm", module: "crm" },
	{ key: "tasks_projects", icon: MdChat, href: "/crm/tasks", module: "tasks" },
	{ key: "inventory_management", icon: MdViewHeadline, href: "/crm/inventory", module: "inventory" },
	{ key: "marketing", icon: MdOutlineShoppingBag, href: "/crm/marketing", module: "marketing" },
	{ key: "automation", icon: MdAssessment, href: "/crm/automation", module: "automation" },
	{ key: "upgrade_plan", icon: MdKeyboardDoubleArrowUp, href: "/crm/upgrade", module: "billing" },
	{ key: "settings", icon: MdSettingsSuggest, href: "/crm/settings", module: "settings" },
];

// `path` — уже без префикса языка (см. stripLocale).
export function isActivePath(path: string, href: string): boolean {
	if (href === "/crm") return path === "/crm";
	return path === href || path.startsWith(`${href}/`);
}
