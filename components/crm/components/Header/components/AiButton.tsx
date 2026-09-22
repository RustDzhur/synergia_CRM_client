"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { MdAutoAwesome } from "react-icons/md";
import { useAiStore } from "@/app/store/useAiStore";

// Кнопка «Firmspace AI» в шапке (то же открывается по Ctrl/⌘ + K)
export default function AiButton() {
	const t = useTranslations("ai");
	const show = useAiStore((s) => s.show);
	return (
		<button type="button" onClick={() => show()} aria-label={t("title")} title={`${t("title")} (Ctrl/⌘ K)`} className="flex">
			<MdAutoAwesome size={24} className="text-primaryColor" />
		</button>
	);
}
