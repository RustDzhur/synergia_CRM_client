"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MdAutoAwesome } from "react-icons/md";
import { useAiStore } from "@/store/useAiStore";
import { stripLocale } from "@/utils/locale";

// «✨ AI summary» в карточке сделки, контакта или компании: открывает ассистента и сразу просит краткую сводку по этой записи
export default function AiSummaryButton({ kind, name, className = "" }: { kind: "deal" | "contact" | "company"; name: string; className?: string }) {
	const t = useTranslations("ai");
	const locale = useLocale();
	const path = stripLocale(usePathname());
	const { show, send, status, loadStatus } = useAiStore();
	useEffect(() => { if (!useAiStore.getState().status) loadStatus(); }, [loadStatus]);
	if (status && (!status.configured || !status.tools.some((x) => x.name === (kind === "deal" ? "get_deal" : kind === "contact" ? "get_contact" : "get_company")))) return null;

	function run() {
		show();
		send(t(`summarize_${kind}`, { name }), { locale, page: path });
	}
	return (
		<button type="button" onClick={run} className={`flex shrink-0 items-center gap-6 rounded-10 border border-inkLine bg-[rgba(255,255,255,0.03)] px-12 py-6 text-12 font-medium text-[#c6ff4d] transition-colors hover:bg-[rgba(198,255,77,0.08)] ${className}`}>
			<MdAutoAwesome size={16} aria-hidden />
			{t("summary")}
		</button>
	);
}
