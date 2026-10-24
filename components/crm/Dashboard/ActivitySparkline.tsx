"use client";
import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Deal } from "@/store/useCrmStore";
import { localeTag } from "@/utils/dateHelpers";

const W = 420;
const H = 150;
const M = { left: 8, right: 8, top: 22, bottom: 26 };
const DAYS = 14;

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

// «Пульс» кабинета: сколько новых сделок заводили в каждый из последних 14 дней.
// Мини-спарклайн в стиле сайта: градиентная линия cyan→violet, мягкая область, свечение,
// линия «прорисовывается» при появлении; при наведении — день и число.
export default function ActivitySparkline({ deals }: { deals: Deal[] }) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const [hover, setHover] = useState<number | null>(null);
	const lineId = useId().replace(/:/g, "");
	const areaId = useId().replace(/:/g, "");

	const { labels, values } = useMemo(() => {
		const now = new Date();
		const tag = localeTag(locale);
		const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const start = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAYS - 1)));
		const counts = Array.from({ length: DAYS }, () => 0);
		deals.forEach((d) => {
			const at = d.createdAt ? new Date(d.createdAt) : null;
			if (!at || Number.isNaN(at.getTime())) return;
			const i = Math.round((dayOf(at) - start) / 86400000);
			if (i >= 0 && i < DAYS) counts[i] += 1;
		});
		const labels = Array.from({ length: DAYS }, (_, i) =>
			new Date(start + i * 86400000).toLocaleDateString(tag, { day: "numeric", month: "short" }),
		);
		return { labels, values: counts };
	}, [deals, locale]);

	const max = Math.max(1, ...values);
	const total = values.reduce((a, b) => a + b, 0);
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	const x = (i: number) => M.left + (i / (DAYS - 1)) * plotW;
	const y = (v: number) => M.top + plotH - (v / max) * plotH;
	const floor = y(0);
	const points = values.map((v, i) => [x(i), y(v)] as [number, number]);
	const line = smoothPath(points, floor);
	const area = `${line} L${x(DAYS - 1)},${floor} L${x(0)},${floor} Z`;
	const peak = values.indexOf(Math.max(...values));
	const shown = hover ?? peak;

	return (
		<section className="fs-card p-16 md:p-20">
			<header className="flex items-center justify-between gap-12">
				<h2 className="shrink-0 text-14 font-semibold text-[#edf2ff]">{t("activityTitle")}</h2>
				<span className="fs-chip">{t("activityLastDays", { n: DAYS })}</span>
			</header>
			<p className="mt-10 text-12 text-[#9aa7c9]">
				{t("activityNewDeals")}: <span className="font-semibold text-[#edf2ff]">{total}</span>
			</p>
			<div className="mt-10">
				<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("activityTitle")} onMouseLeave={() => setHover(null)}>
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
					{[0, Math.floor((DAYS - 1) / 2), DAYS - 1].map((i) => (
						<text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === DAYS - 1 ? "end" : "middle"} fontSize="12" fill="#9aa7c9">{labels[i]}</text>
					))}
					{values.map((_, i) => (
						<rect key={i} x={x(i) - plotW / DAYS / 2} y={M.top} width={plotW / DAYS} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)}>
							<title>{`${labels[i]}: ${values[i]}`}</title>
						</rect>
					))}
					{shown >= 0 && (
						<g pointerEvents="none">
							<line x1={x(shown)} x2={x(shown)} y1={y(values[shown])} y2={floor} stroke="#7c93ff" strokeOpacity="0.5" strokeWidth="1" className="fs-chart-guide" />
							<circle cx={x(shown)} cy={y(values[shown])} r="4.5" fill="#0b1120" stroke="#a2b3ff" strokeWidth="2" />
							<text x={Math.min(Math.max(x(shown), M.left + 34), W - M.right - 34)} y={Math.max(y(values[shown]) - 12, M.top + 10)} textAnchor="middle" fontSize="12" fontWeight="600" fill="#edf2ff">
								{labels[shown]} · {values[shown]}
							</text>
						</g>
					)}
				</svg>
			</div>
		</section>
	);
}
