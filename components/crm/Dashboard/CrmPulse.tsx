"use client";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCrmStore } from "@/store/useCrmStore";
import { useTaskStore, taskStatus } from "@/store/useTaskStore";
import { useFinanceStore } from "@/store/useFinanceStore";
import { useFeature, useOrgStore } from "@/store/useOrgStore";
import { money } from "../Finance/format";
import styles from "./CrmPulse.module.css";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const W = 720;
const H = 200;

function smooth(values: number[], max: number): string {
	if (values.length === 0) return "";
	const step = W / Math.max(1, values.length - 1);
	const points = values.map((value, index) => ({
		x: index * step,
		y: H - (max > 0 ? (value / max) * (H - 16) : 0) - 8,
	}));
	return points
		.map((point, index) => {
			if (index === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
			const previous = points[index - 1]!;
			const middle = (previous.x + point.x) / 2;
			return `C${middle.toFixed(1)},${previous.y.toFixed(1)} ${middle.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
		})
		.join(" ");
}

function area(values: number[], max: number): string {
	const line = smooth(values, max);
	return line ? `${line} L${W},${H} L0,${H} Z` : "";
}

/** Glass overview for CRM: money flow, pipeline and tasks in one glance. */
export default function CrmPulse() {
	const t = useTranslations("dashboard.crmPulse");
	const locale = useLocale();
	const enabled = useFeature("inventory");
	const planLoaded = useOrgStore((s) => s.loaded);
	const { dashboard, settings } = useFinanceStore();
	const deals = useCrmStore((s) => s.deals);
	const stages = useCrmStore((s) => s.stages);
	const tasks = useTaskStore((s) => s.tasks);

	const currency = settings?.currency ?? "EUR";
	const view = useMemo(() => {
		const series = dashboard?.series ?? [];
		const revenue = series.map((point) => point.revenue);
		const expenses = series.map((point) => point.expenses);
		const max = Math.max(1, ...revenue, ...expenses);
		const byStage = stages
			.map((stage) => ({ name: stage.name, count: deals.filter((deal) => deal.stage === stage._id).length }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);
		const stageMax = Math.max(1, ...byStage.map((stage) => stage.count));
		const active = tasks.filter((task) => taskStatus(task) === "active").length;
		const done = tasks.filter((task) => task.completed).length;
		const ended = tasks.filter((task) => taskStatus(task) === "ended").length;
		const taskTotal = Math.max(1, active + done + ended);
		return {
			revenue,
			expenses,
			max,
			income: dashboard?.revenue ?? 0,
			expense: dashboard?.expenses ?? 0,
			profit: dashboard?.profit ?? 0,
			outstanding: dashboard?.outstandingAmount ?? 0,
			byStage,
			stageMax,
			active,
			done,
			ended,
			taskTotal,
		};
	}, [dashboard, deals, stages, tasks]);

	if (!planLoaded || !enabled || !dashboard) return null;

	const activeShare = (view.active / view.taskTotal) * 100;
	const doneShare = view.active / view.taskTotal * 100 + (view.done / view.taskTotal) * 100;

	return (
		<section className={styles.shell} aria-label={t("aria")}>
			<div className={styles.aurora} aria-hidden="true" />
			<header className={styles.head}>
				<div>
					<p className={styles.eyebrow}>{t("eyebrow")}</p>
					<h2 className={styles.title}>{t("title")}</h2>
				</div>
			</header>

			<div className={styles.grid}>
				<article className={styles.glass}>
					<div className={styles.cardHead}>
						<h3>{t("money")}</h3>
						<span className={styles.pill}>{t("moneyPill")}</span>
					</div>
					<div className={styles.kpis}>
						<div><span className={styles.label}>{t("income")}</span><strong className={styles.income}>{money(view.income, currency, locale)}</strong></div>
						<div><span className={styles.label}>{t("expenses")}</span><strong className={styles.expense}>{money(view.expense, currency, locale)}</strong></div>
						<div><span className={styles.label}>{t("profit")}</span><strong className={view.profit >= 0 ? styles.income : styles.expense}>{money(view.profit, currency, locale)}</strong></div>
						<div><span className={styles.label}>{t("outstanding")}</span><strong className={styles.cyan}>{money(view.outstanding, currency, locale)}</strong></div>
					</div>
					<svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("chartAria")}>
						<defs>
							<linearGradient id="crm-income" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
								<stop offset="100%" stopColor="#34d399" stopOpacity="0" />
							</linearGradient>
							<linearGradient id="crm-expense" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#fb7185" stopOpacity="0.35" />
								<stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
							</linearGradient>
							<filter id="crm-glow" x="-20%" y="-20%" width="140%" height="140%">
								<feGaussianBlur stdDeviation="4" result="blur" />
								<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
							</filter>
						</defs>
						<path d={area(view.revenue, view.max)} fill="url(#crm-income)" />
						<path d={area(view.expenses, view.max)} fill="url(#crm-expense)" />
						<path d={smooth(view.revenue, view.max)} fill="none" stroke="#34d399" strokeWidth="2.5" filter="url(#crm-glow)" />
						<path d={smooth(view.expenses, view.max)} fill="none" stroke="#fb7185" strokeWidth="2.5" filter="url(#crm-glow)" />
					</svg>
					<div className={styles.months} aria-hidden="true">
						{(dashboard.series.length ? dashboard.series.map((s) => Number(s.month.slice(5))) : MONTHS.map((_, i) => i + 1)).map((month, index) => (
							<span key={`${month}-${index}`}>{MONTHS[(month - 1) % 12]}</span>
						))}
					</div>
				</article>

				<article className={styles.glass}>
					<div className={styles.cardHead}>
						<h3>{t("tasks")}</h3>
						<span className={styles.pill}>{t("tasksPill")}</span>
					</div>
					<div className={styles.donutRow}>
						<div
							className={styles.donut}
							style={{ background: `conic-gradient(#f472b6 0 ${activeShare}%, #34d399 ${activeShare}% ${doneShare}%, #fbbf24 ${doneShare}% 100%)` }}
							role="img"
							aria-label={t("tasksAria")}
						>
							<div className={styles.donutHole}>
								<strong>{view.active + view.done + view.ended}</strong>
								<span>{t("tasksTotal")}</span>
							</div>
						</div>
						<ul className={styles.legend}>
							<li><i className={styles.dotPink} /><span>{t("active")}</span><strong>{view.active}</strong></li>
							<li><i className={styles.dotGreen} /><span>{t("completed")}</span><strong>{view.done}</strong></li>
							<li><i className={styles.dotAmber} /><span>{t("ended")}</span><strong>{view.ended}</strong></li>
						</ul>
					</div>
				</article>
			</div>

			<article className={`${styles.glass} ${styles.pipeline}`}>
				<div className={styles.cardHead}>
					<h3>{t("pipeline")}</h3>
					<span className={styles.pill}>{t("pipelinePill")}</span>
				</div>
				<div className={styles.stageList}>
					{view.byStage.length === 0 ? (
						<p className={styles.muted}>{t("noDeals")}</p>
					) : (
						view.byStage.map((stage, index) => (
							<div key={stage.name} className={styles.stageRow}>
								<span className={styles.stageName}>{stage.name}</span>
								<span className={styles.stageTrack}>
									<span
										className={styles.stageFill}
										style={{
											width: `${Math.max(4, (stage.count / view.stageMax) * 100)}%`,
											background: ["linear-gradient(90deg,#22d3ee,#60a5fa)", "linear-gradient(90deg,#a78bfa,#f472b6)", "linear-gradient(90deg,#34d399,#22d3ee)", "linear-gradient(90deg,#fbbf24,#fb7185)", "linear-gradient(90deg,#f472b6,#a78bfa)"][index % 5],
										}}
									/>
								</span>
								<strong>{stage.count}</strong>
							</div>
						))
					)}
				</div>
			</article>
		</section>
	);
}
