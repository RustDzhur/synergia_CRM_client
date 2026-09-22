"use client";
import React, { useState } from "react";
import { useLocale } from "next-intl";
import type { AdsDay } from "@/lib/ads/types";
import { count, money } from "./adsFormat";

const W = 420;
const H = 200;
const M = { left: 8, right: 8, top: 16, bottom: 28 };

// Расход по дням столбиками; при наведении — сумма и клики за день
export default function SpendChart({ days, currency, label }: { days: AdsDay[]; currency: string; label: string }) {
	const locale = useLocale();
	const [hover, setHover] = useState<number | null>(null);
	const max = Math.max(...days.map((d) => d.spend), 0);
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	const slot = days.length ? plotW / days.length : plotW;
	const bar = Math.max(2, slot * 0.7);
	const shown = hover ?? (max > 0 ? days.findIndex((d) => d.spend === max) : -1);
	const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });
	const ticks = days.length > 1 ? [0, Math.floor((days.length - 1) / 2), days.length - 1] : [0];

	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
			<line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="#D9D9D9" />
			{days.map((d, i) => {
				const h = max ? (d.spend / max) * plotH : 0;
				return (
					<g key={d.date} onMouseEnter={() => setHover(i)}>
						<rect x={M.left + i * slot} y={M.top} width={slot} height={plotH} fill="transparent" />
						<rect x={M.left + i * slot + (slot - bar) / 2} y={H - M.bottom - h} width={bar} height={Math.max(h, d.spend > 0 ? 2 : 0)} rx="2" fill={i === shown ? "#5EA8F5" : "#8CB5E1"} />
					</g>
				);
			})}
			{ticks.map((i) => days[i] && (
				<text key={i} x={M.left + i * slot + slot / 2} y={H - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 && days.length > 1 ? "end" : "middle"} fontSize="13" fill="#999999">{dayLabel(days[i].date)}</text>
			))}
			{shown >= 0 && days[shown] && max > 0 && (
				<text x={Math.min(Math.max(M.left + shown * slot + slot / 2, 60), W - 60)} y={12} textAnchor="middle" fontSize="13" fontWeight="600" fill="#4D4D4D" pointerEvents="none">
					{dayLabel(days[shown].date)} · {money(days[shown].spend, currency, locale)} · {count(days[shown].clicks, locale)} ↗
				</text>
			)}
		</svg>
	);
}
