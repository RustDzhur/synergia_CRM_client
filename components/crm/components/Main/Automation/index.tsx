"use client";
import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCrmStore } from "@/app/store/useCrmStore";
import RecordsPage from "../shared/records/RecordsPage";
import { AUTOMATION } from "./config";
import RulesTab from "./RulesTab";

// Automation (/crm/automation): Automation Rules (правила и триггеры по этапам сделок), Variables, Constants, Test Logs.
// Этапы берутся из CRM (те же, что на доске сделок); таблицы общие — см. shared/records.
export default function Automation() {
	const t = useTranslations("automation");
	const stages = useCrmStore((s) => s.stages);
	const fetchAll = useCrmStore((s) => s.fetchAll);

	useEffect(() => {
		fetchAll();
	}, [fetchAll]);

	const stageOptions = useMemo(
		() => [{ value: "", label: t("anyStage") }, ...[...stages].sort((a, b) => a.order - b.order).map((s) => ({ value: s._id, label: s.name }))],
		[stages, t]
	);

	return (
		<RecordsPage
			config={AUTOMATION}
			fieldOptions={(_tab, key) => (key === "stage" ? stageOptions : undefined)}
			renderCustom={(_tab, api) => <RulesTab {...api} stages={stages} />}
		/>
	);
}
