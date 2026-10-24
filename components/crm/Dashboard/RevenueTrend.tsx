"use client";
import { useEffect, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useFinanceStore } from "@/store/useFinanceStore";
import { useFeature, useOrgStore } from "@/store/useOrgStore";
import { money } from "../Finance/format";

const W = 420;
const H = 180;
const M = { left: 8, right: 8, top: 24, bottom: 28 };

// Сглаженная линия через точки (Catmull-Rom -> кубические кривые Безье)
function smoothPath(points: Array<[number, number]>, floor: number): string {
	if (points.length === 0) return "";
	if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
	let d = `M${points[0][0]},${points[0][1]}`;
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;
		const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(floor, p1[1] + (p2[1] - p0[1]) / 6)];
		const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(floor, p2[1] - (p3[1] - p1[1]) / 6)];
		d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
	}
	return d;
}

// Тренд дохода по месяцам: та же серия, что в карточке Finance, но линией в стиле сайта —
// градиент cyan→violet, свечение, прорисовка при появлении и подсказка при наведении.
export default function RevenueTrend() {
	const t = useTranslations("finance");
	const td = useTranslations("dashboard");
	const locale = useLocale();
	const [hover, setHover] = useState<number | null>(null);
	const lineId = useId().replace(/:/g, "");
	const areaId = useId().replace(/:/g, "");
	const enabled = useFeature("inventory");
	const planLoaded = useOrgStore((s) => s.loaded);
	const { dashboard, loadDashboard, settings, loadSettings } = useFinanceStore();
	useEffect(() => { if (planLoaded && enabled) { loadSettings(); loadDashboard(12, new Date().getFullYear()); } }, [planLoaded, enabled, loadSettings, loadDashboard]);

	if (!planLoaded || !enabled || !dashboard) return null;
	const currency = settings?.currency ?? "EUR";
	const series = dashboard.series;
	if (!series.length) return null;

	const values = series.map((s) => s.revenue);
	const max = Math.max(1, ...values);
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	const n = values.length;
	const x = (i: number) => M.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
	const y = (v: number) => M.top + plotH - (v / max) * plotH;
	const floor = y(0);
	const points = values.map((v, i) => [x(i), y(v)] as [number, number]);
	const line = smoothPath(points, floor);
	const area = `${line} L${x(n - 1)},${floor} L${x(0)},${floor} Z`;
	const peak = values.indexOf(Math.max(...values));
	const shown = hover ?? peak;
	const monthLabel = (m: string) => String(Number(m.slice(5))).padStart(2, "0");

	return (
		<section className="fs-card p-16 md:p-20">
			<header className="flex items-center justify-between gap-12">
				<h2 className="shrink-0 text-14 font-semibold text-[#edf2ff]">{td("revenueTrendTitle")}</h2>
				<span className="fs-chip">{t("kpiRevenue")}</span>
			</header>
			<div className="mt-12">
				<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={td("revenueTrendTitle")} onMouseLeave={() => setHover(null)}>
					<defs>
						<linearGradient id={lineId} x1="0" y1="0" x2="1" y2="0">
							<stop offset="0%" stopColor="#22d3ee" />
							<stop offset="50%" stopColor="#7c93ff" />
							<stop offset="100%" stopColor="#a78bfa" />
						</linearGradient>
						<linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#7c93ff" stopOpacity="0.3" />
							<stop offset="100%" stopColor="#7c93ff" stopOpacity="0" />
						</linearGradient>
					</defs>
					<line x1={M.left} x2={W - M.right} y1={floor} y2={floor} stroke="rgba(255,255,255,0.12)" />
					<path d={area} fill={`url(#${areaId})`} className="fs-chart-area" />
					<path d={line} pathLength={1} fill="none" stroke={`url(#${lineId})`} strokeWidth="2.5" strokeLinecap="round" className="fs-chart-line fs-chart-glow" />
					{[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
						<text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="12" fill="#9aa7c9">{monthLabel(series[i].month)}</text>
					))}
					{values.map((_, i) => (
						<rect key={i} x={x(i) - plotW / n / 2} y={M.top} width={plotW / n} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)}>
							<title>{`${series[i].month}: ${money(values[i], currency, locale)}`}</title>
						</rect>
					))}
					{shown >= 0 && max > 0 && (
						<g pointerEvents="none">
							<line x1={x(shown)} x2={x(shown)} y1={y(values[shown])} y2={floor} stroke="#7c93ff" strokeOpacity="0.5" strokeWidth="1" className="fs-chart-guide" />
							<circle cx={x(shown)} cy={y(values[shown])} r="4.5" fill="#0b1120" stroke="#a2b3ff" strokeWidth="2" />
							<text x={Math.min(Math.max(x(shown), M.left + 48), W - M.right - 48)} y={Math.max(y(values[shown]) - 12, M.top + 10)} textAnchor="middle" fontSize="12" fontWeight="600" fill="#edf2ff">
								{money(values[shown], currency, locale)}
							</text>
						</g>
					)}
				</svg>
			</div>
		</section>
	);
}
