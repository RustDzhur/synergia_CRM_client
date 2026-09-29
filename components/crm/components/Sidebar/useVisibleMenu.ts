import { useMemo } from "react";
import { useActiveOrg } from "@/store/useOrgStore";
import { menuItems, type MenuItem } from "./menuItems";

// Пункты меню, доступные роли пользователя и тарифу фирмы. Пока фирма не загрузилась, показываем всё
// (сервер всё равно проверит и доступ, и тариф).
export function useVisibleMenu() {
	const org = useActiveOrg();
	return useMemo(() => {
		if (!org) return menuItems;
		const byRole = menuItems.filter((i) => !i.module || org.modules.includes(i.module));
		return byRole
			.map((i) => (i.children ? { ...i, children: i.children.filter((c) => !c.feature || org.features?.[c.feature] !== false) } : i))
			.filter((i: MenuItem) => {
				if (i.feature && org.features?.[i.feature] === false) return false;
				// пункт с вложенными виден, пока виден хотя бы один вложенный
				if (i.children && i.children.length === 0) return false;
				return true;
			});
	}, [org]);
}
