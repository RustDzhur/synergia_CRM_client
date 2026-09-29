// Убирает префикс языка из пути: "/en/crm/crm" -> "/crm/crm", "/crm" -> "/crm".
// Для языка по умолчанию (de) next-intl может отдавать URL без префикса,
// поэтому нельзя сравнивать pathname с `/${locale}/...` напрямую.
export function stripLocale(pathname: string): string {
	const stripped = pathname.replace(/^\/(ua|en|de)(?=\/|$)/, "");
	return stripped === "" ? "/" : stripped;
}

// Адрес страницы с языком: withLocale("ua", "/about") -> "/ua/about", withLocale("en", "/") -> "/en".
// Язык всегда пишется явно: раньше для "ua" путь строился без префикса, а без префикса открывается язык по умолчанию (de).
export function withLocale(code: string, path: string): string {
	return `/${code}${path === "/" ? "" : path}`;
}
