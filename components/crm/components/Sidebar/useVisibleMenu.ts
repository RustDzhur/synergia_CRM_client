import { useMemo } from "react";
import { useActiveOrg } from "@/app/store/useOrgStore";
import { menuItems } from "./menuItems";

// Пункты меню, доступные роли пользователя в текущей фирме. Пока фирма не загрузилась, показываем всё (сервер всё равно проверит доступ).
export function useVisibleMenu() {
	const org = useActiveOrg();
	return useMemo(() => (org ? menuItems.filter((i) => !i.module || org.modules.includes(i.module)) : menuItems), [org]);
}
