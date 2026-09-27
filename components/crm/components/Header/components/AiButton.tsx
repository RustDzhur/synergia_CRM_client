"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { TbSparkles } from "react-icons/tb";
import { useAiStore } from "@/app/store/useAiStore";

// Кнопка «Firmspace AI» в шапке (то же открывается по Ctrl/⌘ + K)
export default function AiButton() {
	const t = useTranslations("ai");
	const show = useAiStore((s) => s.show);
	return (
		<button
			type="button"
			onClick={() => show()}
			aria-label={t("title")}
			title={`${t("title")} (Ctrl/⌘ K)`}
			className="flex h-34 w-34 items-center justify-center rounded-9 text-[#c6ff4d] transition-colors hover:bg-[rgba(198,255,77,0.12)]">
			<TbSparkles size={19} />
		</button>
	);
}
