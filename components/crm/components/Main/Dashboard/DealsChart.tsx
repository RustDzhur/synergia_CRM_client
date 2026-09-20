"use client";
import React, { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Deal, Stage } from "@/app/store/useCrmStore";
import { localeTag } from "@/app/utils/dateHelpers";
import PeriodSelect from "./PeriodSelect";

type Period = "monthly" | "weekly" | "yearly";

interface Props {
	deals: Deal[];
	stages: Stage[];
}

const W = 420;
const H = 250;
const M = { left: 46, right: 14, top: 14, bottom: 34 };

// «Красивое» максимальное значение оси: 4 интервала с шагом 1, 2, 5, 10, 20, 25, 50 ...
function niceAxis(max: number): { top: number; step: number } {
	if (max <= 4) return { top: 4, step: 1 };
	const raw = max / 4;
	const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 5000, 10000];
	const step = steps.find((s) => s >= raw) ?? Math.ceil(raw / 1000) * 1000;
	return { top: step * 4, step };
}

// Сглаженная линия через точки (Catmull-Rom -> кубические кривые Безье), значения не «проваливаются» ниже оси
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

// График «Deals»: число закрытых сделок по времени. Закрытой считается сделка в последней стадии воронки;
// датой закрытия — время последнего изменения сделки.
export default function DealsChart({ deals, stages }: Props) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const [period, setPeriod] = useState<Period>("monthly");
	const [hover, setHover] = useState<number | null>(null);
	const gradientId = useId().replace(/:/g, "");

	const { labels, values, tickIdx } = useMemo(() => {
		const now = new Date();
		const tag = localeTag(locale);
		const lastStage = [...stages].sort((a, b) => a.order - b.order).at(-1);
		const closed = lastStage ? deals.filter((d) => d.stage === lastStage._id) : [];
		const dates = closed.map((d) => new Date(d.updatedAt ?? d.createdAt ?? now));

		let bucketCount: number;
		let labelOf: (i: number) => string;
		let indexOf: (date: Date) => number;

		if (period === "yearly") {
			bucketCount = 12;
			labelOf = (i) => new Date(now.getFullYear(), i, 1).toLocaleDateString(tag, { month: "short" });
			indexOf = (d) => (d.getFullYear() === now.getFullYear() ? d.getMonth() : -1);
		} else if (period === "weekly") {
			bucketCount = 7;
			const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
			labelOf = (i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).toLocaleDateString(tag, { day: "numeric", month: "short" });
			indexOf = (d) => Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start.getTime()) / 86400000);
		} else {
			bucketCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
			labelOf = (i) => new Date(now.getFullYear(), now.getMonth(), i + 1).toLocaleDateString(tag, { day: "numeric", month: "short" });
			indexOf = (d) => (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() ? d.getDate() - 1 : -1);
		}

		const counts = Array.from({ length: bucketCount }, () => 0);
		dates.forEach((d) => {
			const i = indexOf(d);
			if (i >= 0 && i < bucketCount) counts[i] += 1;
		});
		// 4 подписи по оси X: начало, две трети и конец — как «1 Dec, 8 Dec, 16 Dec, 31 Dec» в макете
		const last = bucketCount - 1;
		const tickIdx = Array.from(new Set([0, Math.round(last / 3), Math.round((last * 2) / 3), last]));
		return { labels: Array.from({ length: bucketCount }, (_, i) => labelOf(i)), values: counts, tickIdx };
	}, [deals, stages, period, locale]);

	const max = Math.max(0, ...values);
	const { top, step } = niceAxis(max);
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	const x = (i: number) => M.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
	const y = (v: number) => M.top + plotH - (v / top) * plotH;
	const points = values.map((v, i) => [x(i), y(v)] as [number, number]);
	const floor = y(0);
	const line = smoothPath(points, floor);
	const area = points.length > 1 ? `${line} L${x(values.length - 1)},${floor} L${x(0)},${floor} Z` : "";
	const peak = max > 0 ? values.indexOf(max) : -1;
	const shown = hover ?? peak;

	return (
		<section className="rounded-16 border border-[#F0F0F0] bg-white p-20 shadow-[0_2px_8px_rgba(0,0,0,0.16)] md:p-25">
			<header className="flex items-center justify-between gap-12">
				<h2 className="text-20 font-medium text-[#4D4D4D] md:text-24">{t("dealsTitle")}</h2>
				<PeriodSelect<Period>
					value={period}
					onChange={setPeriod}
					options={[
						{ value: "monthly", label: t("monthly") },
						{ value: "weekly", label: t("weekly") },
						{ value: "yearly", label: t("yearly") },
					]}
				/>
			</header>

			<p className="mt-16 flex items-center gap-8 text-16 font-medium text-[#999999]">
				{t("closedDeals")}
				<span className="inline-block h-[10px] w-[10px] rounded-50 border-2 border-primaryColor" />
			</p>

			<svg viewBox={`0 0 ${W} ${H}`} className="mt-8 w-full" role="img" aria-label={t("closedDeals")} onMouseLeave={() => setHover(null)}>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#8CB5E1" />
						<stop offset="100%" stopColor="#EDF4FA" />
					</linearGradient>
				</defs>

				{Array.from({ length: 5 }, (_, i) => i * step).map((tick) => (
					<g key={tick}>
						<line x1={M.left - 4} x2={W - M.right} y1={y(tick)} y2={y(tick)} stroke="#666666" strokeOpacity="0.7" strokeDasharray="6 6" strokeWidth="1" />
						<text x={M.left - 12} y={y(tick) + 5} textAnchor="end" fontSize="15" fill="#999999">{tick}</text>
					</g>
				))}

				{area && <path d={area} fill={`url(#${gradientId})`} />}
				{line && max > 0 && <path d={line} fill="none" stroke="#6FA1DA" strokeWidth="1.5" />}

				{tickIdx.map((i) => (
					// крайние подписи выравниваем внутрь графика, иначе последняя обрезается по краю
					<text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"} fontSize="14" fill="#999999">{labels[i]}</text>
				))}

				{/* невидимые колонки для наведения: показывают значение точки под курсором */}
				{values.map((_, i) => (
					<rect
						key={i}
						x={x(i) - plotW / values.length / 2}
						y={M.top}
						width={plotW / values.length}
						height={plotH}
						fill="transparent"
						onMouseEnter={() => setHover(i)}
					>
						<title>{`${labels[i]}: ${values[i]}`}</title>
					</rect>
				))}

				{shown >= 0 && max > 0 && (
					<g pointerEvents="none">
						<circle cx={x(shown)} cy={y(values[shown])} r="4.5" fill="#ffffff" stroke="#5EA8F5" strokeWidth="2" />
						<text x={Math.min(Math.max(x(shown), M.left + 20), W - M.right - 20)} y={y(values[shown]) - 12} textAnchor="middle" fontSize="14" fontWeight="600" fill="#4D4D4D">
							{values[shown]}
						</text>
					</g>
				)}
			</svg>
			{max === 0 && <p className="text-center text-14 text-[#999999]">{t("noData")}</p>}
		</section>
	);
}
