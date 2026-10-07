import type { IconType } from "react-icons";
import type { FeatureKey } from "@/config/plans";
import {
	TbLayoutDashboard,
	TbLayoutGrid,
	TbAddressBook,
	TbBuildingSkyscraper,
	TbCheckbox,
	TbCoin,
	TbSpeakerphone,
	TbRobot,
	TbArrowUpCircle,
	TbSettings,
} from "react-icons/tb";

export interface SubMenuItem {
	key: string; // ключ перевода в messages -> navigation
	href: string; // путь без префикса языка
	feature?: FeatureKey; // раздел тарифа (app/config/plans.ts); без него пункт виден всем
}

// Группа пунктов в сайдбаре: над каждой группой стоит её название мелким разряженным шрифтом.
// Значения — ключи в messages -> navigation.groups.
export type MenuGroup = "workspace" | "collaboration" | "customers" | "organization" | "operations" | "administration";

export interface MenuItem {
	key: string;
	module?: string; // раздел доступа (lib/access.ts); без него пункт виден всем
	feature?: FeatureKey; // раздел тарифа (app/config/plans.ts): чего нет в тарифе фирмы, того нет и в меню
	icon: IconType;
	href: string;
	group: MenuGroup;
	children?: SubMenuItem[];
}

// Единый список пунктов меню для сайдбара (desktop/tablet) и мобильного меню.
// Порядок и состав — как в макете: Contacts здесь нет, это вкладка внутри CRM.
// group задаёт заголовок, под которым пункт стоит в сайдбаре; соседние пункты с одной группой
// попадают под один заголовок, поэтому список должен быть сгруппирован по порядку.
export const menuItems: MenuItem[] = [
	{ key: "dashboard", icon: TbLayoutDashboard, href: "/crm", group: "workspace" },
	{
		key: "collaboration",
		module: "collab",
		icon: TbLayoutGrid,
		href: "/crm/collaboration",
		group: "collaboration",
		// у пункта с вложенными разделы берутся у вложенных: он виден, пока виден хотя бы один из них
		children: [
			{ key: "feed", href: "/crm/collaboration/feed", feature: "collab" },
			{ key: "chat_and_calls", href: "/crm/collaboration/chat-and-calls", feature: "channels" },
			{ key: "calendar", href: "/crm/collaboration/calendar", feature: "collab" },
			{ key: "online_documents", href: "/crm/collaboration/online-documents", feature: "documents" },
			{ key: "web_mails", href: "/crm/collaboration/web-mails", feature: "mail" },
		],
	},
	{ key: "crm", icon: TbAddressBook, href: "/crm/crm", feature: "crm", module: "crm", group: "customers" },
	// «Meine Firma» — это собственный бизнес клиента: сотрудники и база знаний.
	// Лежит отдельно от клиентов, потому что в CRM «Firmen» — это фирмы-заказчики,
	// и рядом они читались как одно и то же.
	{ key: "company", icon: TbBuildingSkyscraper, href: "/crm/company", feature: "company", module: "company", group: "organization" },
	{ key: "tasks_projects", icon: TbCheckbox, href: "/crm/tasks", feature: "tasks", module: "tasks", group: "operations" },
	{ key: "inventory_management", icon: TbCoin, href: "/crm/finance", feature: "inventory", module: "inventory", group: "operations" },
	{ key: "marketing", icon: TbSpeakerphone, href: "/crm/marketing", feature: "marketing", module: "marketing", group: "operations" },
	{ key: "automation", icon: TbRobot, href: "/crm/automation", feature: "automation", module: "automation", group: "operations" },
	{ key: "upgrade_plan", icon: TbArrowUpCircle, href: "/crm/upgrade", module: "billing", group: "administration" },
	{ key: "settings", icon: TbSettings, href: "/crm/settings", module: "settings", group: "administration" },
];

// `path` — уже без префикса языка (см. stripLocale).
export function isActivePath(path: string, href: string): boolean {
	if (href === "/crm") return path === "/crm";
	return path === href || path.startsWith(`${href}/`);
}

// Заголовок страницы для хлебных крошек и мобильной плашки — по текущему пути.
// У раздела с вложенными (Zusammenarbeit) берём самый точный пункт: путь /crm/collaboration/calendar
// совпадает и с родителем, и с вложенным, а показать нужно вложенный.
export function currentMenuItem(path: string): MenuItem | undefined {
	const parent = menuItems.find((i) => isActivePath(path, i.href));
	if (!parent) return undefined;
	const child = parent.children?.find((c) => isActivePath(path, c.href));
	if (!child) return parent;
	return { ...parent, key: child.key, href: child.href, children: undefined };
}
