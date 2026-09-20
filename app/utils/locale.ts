// Убирает префикс языка из пути: "/en/crm/crm" -> "/crm/crm", "/crm" -> "/crm".
// Для языка по умолчанию (de) next-intl может отдавать URL без префикса,
// поэтому нельзя сравнивать pathname с `/${locale}/...` напрямую.
export function stripLocale(pathname: string): string {
	const stripped = pathname.replace(/^\/(ua|en|de)(?=\/|$)/, "");
	return stripped === "" ? "/" : stripped;
}
