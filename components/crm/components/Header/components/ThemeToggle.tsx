"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useThemeStore } from "@/app/store/useThemeStore";

// Переключатель светлой и тёмной темы CRM (в шапке рядом с колокольчиком)
export default function ThemeToggle() {
	const t = useTranslations("navBar");
	const { theme, toggle } = useThemeStore();
	const dark = theme === "dark";
	return (
		<button type="button" onClick={toggle} aria-pressed={dark} aria-label={dark ? t("themeLight") : t("themeDark")} title={dark ? t("themeLight") : t("themeDark")} className="flex">
			{dark ? <MdLightMode size={24} color="#B3B3B3" /> : <MdDarkMode size={24} color="#B3B3B3" />}
		</button>
	);
}
