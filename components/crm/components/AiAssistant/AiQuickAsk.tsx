"use client";
import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { MdAutoAwesome } from "react-icons/md";
import { useAiStore } from "@/app/store/useAiStore";
import { stripLocale } from "@/app/utils/locale";

// Кнопка-подсказка для ассистента: открывает Firmspace AI и сразу отправляет готовый вопрос (например, «Analyze» на письме
// или документе). Прячется, если у пользователя нет нужного инструмента (роль без доступа к разделу, ИИ не настроен).
export default function AiQuickAsk({ prompt, requiredTool, label, className = "" }: { prompt: string; requiredTool: string; label: string; className?: string }) {
	const locale = useLocale();
	const path = stripLocale(usePathname());
	const { show, send, status, loadStatus } = useAiStore();
	useEffect(() => { if (!useAiStore.getState().status) loadStatus(); }, [loadStatus]);
	if (status && (!status.configured || !status.tools.some((x) => x.name === requiredTool))) return null;

	return (
		<button
			type="button"
			onClick={() => { show(); send(prompt, { locale, page: path }); }}
			className={`flex shrink-0 items-center gap-6 rounded-8 border border-[#D6E6FA] bg-[#F5F9FF] px-12 py-6 text-14 font-medium text-primaryColor transition-colors hover:bg-[#EAF2FE] ${className}`}>
			<MdAutoAwesome size={16} aria-hidden />
			{label}
		</button>
	);
}
