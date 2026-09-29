"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TbAlertTriangle, TbSparkles } from "react-icons/tb";
import { apiCall } from "@/store/crmApi";
import { TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../shared/tabBar";
import type { PeriodKind } from "@/lib/finance/reports";

// Общие детали отчётов Steuern (UStVA, EÜR) и Auswertungen (BWA, SuSa): переключатель периода, запрос отчёта
// у сервера и разбор от ИИ. Оба экрана пользуются ими, чтобы не дублировать разметку и запросы.

export type ReportKind = "vat" | "eur" | "bwa" | "susa";

// Те же периоды, что понимает /api/finance/reports (lib/finance/reports.ts): месяц, квартал, год.
const PERIODS: PeriodKind[] = ["month", "quarter", "year"];

// Переключатель периода — та же пилюля, что и вкладки раздела, поэтому и классы общие (../shared/tabBar).
export function PeriodSwitch({ value, onChange }: { value: PeriodKind; onChange: (period: PeriodKind) => void }) {
	const t = useTranslations("finance");
	return (
		<div role="group" aria-label={t("periodLabel")} className="flex items-center gap-8">
			{PERIODS.map((p) => (
				<button
					key={p}
					type="button"
					aria-pressed={value === p}
					onClick={() => onChange(p)}
					className={`${TAB_ITEM} ${value === p ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>
					{t(`period_${p}`)}
				</button>
			))}
		</div>
	);
}

// Отчёт считает сервер (lib/finance/reports.ts) — клиент только запрашивает готовые цифры и показывает их.
// Смена периода перезапрашивает отчёт; ответ старого запроса после ухода со экрана не применяется (alive).
export function useReport<T>(kind: ReportKind, period: PeriodKind) {
	const [report, setReport] = useState<T | null>(null);
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let alive = true;
		setLoading(true);
		setFailed(false);
		apiCall<{ period: PeriodKind; report: T }>(`/api/finance/reports?kind=${kind}&period=${period}`, "GET", undefined, { cache: "no-store" }).then((r) => {
			if (!alive) return;
			setLoading(false);
			if (r.ok && r.data) setReport(r.data.report);
			else { setReport(null); setFailed(true); }
		});
		return () => { alive = false; };
	}, [kind, period]);

	return { report, loading, failed };
}

export function ReportLoading() {
	const t = useTranslations("finance");
	return <p className="fs-card p-30 text-center text-13 text-[#8c948b]">{t("loading")}</p>;
}

export function ReportFailed() {
	const t = useTranslations("finance");
	return <p className="fs-card p-30 text-center text-13 text-[#F4A100]">{t("loadFailed")}</p>;
}

// «Mit KI auswerten»: сервер пересказывает уже посчитанный отчёт человеческим языком (/api/finance/reports/analysis).
// Отказ (дневной лимит ИИ в тарифе, ИИ не настроен) — спокойная подсказка, а не красный тост: это не поломка.
export function AiAnalysis({ kind, period }: { kind: ReportKind; period: PeriodKind }) {
	const t = useTranslations("finance");
	const locale = useLocale();
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");

	// период сменился — прошлый разбор был про другие цифры, показывать его нельзя
	useEffect(() => { setText(""); setNotice(""); }, [kind, period]);

	async function run() {
		setBusy(true);
		setNotice("");
		const r = await apiCall<{ kind: string; from: string; to: string; text: string }>(
			`/api/finance/reports/analysis?kind=${kind}&period=${period}&locale=${locale}`, "GET", undefined, { cache: "no-store" });
		setBusy(false);
		if (r.ok && r.data) { setText(r.data.text); return; }
		// известные отказы сервера переводим на язык интерфейса, всё остальное показываем как есть
		const message = (r.message || "").toLowerCase();
		if (message.includes("daily ai limit")) setNotice(t("aiLimit"));
		else if (message.includes("not configured")) setNotice(t("aiNotConfigured"));
		else setNotice(r.message || t("aiFailed"));
	}

	return (
		<div>
			<button type="button" onClick={run} disabled={busy} className="fs-btn fs-btn-primary h-40 disabled:opacity-[0.5]">
				<TbSparkles size={16} aria-hidden />
				{busy ? t("aiAnalyzing") : t("aiAnalyze")}
			</button>
			{text && (
				<div className="fs-card mt-12 p-16 md:p-20">
					<p className="fs-eyebrow">{t("aiTitle")}</p>
					<p className="mt-10 whitespace-pre-wrap text-13 leading-[1.6] text-[#cfd4cb]">{text}</p>
				</div>
			)}
			{notice && <p className="mt-10 text-12 leading-[1.5] text-[#9AA396]">{notice}</p>}
		</div>
	);
}

// Управленческие отчёты, а не бухгалтерские: план счетов система не ведёт, перед подачей цифры проверяет консультант
// (см. комментарий в lib/finance/reports.ts — там это сказано прямым текстом).
export function ReportDisclaimer({ className = "" }: { className?: string }) {
	const t = useTranslations("finance");
	return (
		<p className={`flex items-start gap-8 text-12 leading-[1.5] text-[#9AA396] ${className}`}>
			<TbAlertTriangle size={14} className="mt-[2px] shrink-0 text-[#F4A100]" aria-hidden />
			<span>{t("reportDisclaimer")}</span>
		</p>
	);
}
