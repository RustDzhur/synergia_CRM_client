"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Deal, Stage } from "@/store/useCrmStore";

const W = 420;
const H = 220;
const M = { left: 8, right: 8, top: 26, bottom: 40 };

// Воронка: сколько сделок сейчас на каждой стадии. Столбики с вертикальным градиентом
// cyan→indigo→violet (как на сайте), вырастают снизу, при наведении — свечение и подсказка.
export default function StageBars({ deals, stages }: { deals: Deal[]; stages: Stage[] }) {
	const t = useTranslations("dashboard");
	const [hover, setHover] = useState<number | null>(null);
	const gradId = useId().replace(/:/g, "");
	const ordered = [...stages].sort((a, b) => a.order - b.order);
	const counts = ordered.map((s) => deals.filter((d) => d.stage === s._id).length);
	const max = Math.max(1, ...counts);
	const plotW = W - M.left - M.right;
	const plotH = H - M.top - M.bottom;
	const slot = ordered.length ? plotW / ordered.length : plotW;
	const bar = Math.max(6, Math.min(34, slot * 0.62));
	const shown = hover ?? (counts.some((c) => c > 0) ? counts.indexOf(Math.max(...counts)) : -1);
	const short = (name: string) => (name.length > 10 ? `${name.slice(0, 9)}…` : name);

	return (
		<section className="fs-card p-16 md:p-20">
			<header className="flex items-center justify-between gap-12">
				<h2 className="shrink-0 text-14 font-semibold text-[#edf2ff]">{t("stageBarsTitle")}</h2>
			</header>
			<div className="mt-14">
				<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("stageBarsTitle")} onMouseLeave={() => setHover(null)}>
					<defs>
						<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#22d3ee" />
							<stop offset="55%" stopColor="#7c93ff" />
							<stop offset="100%" stopColor="#a78bfa" />
						</linearGradient>
					</defs>
					<line x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} stroke="rgba(255,255,255,0.12)" />
					{ordered.map((s, i) => {
						const h = (counts[i] / max) * plotH;
						return (
							<g key={s._id} onMouseEnter={() => setHover(i)}>
								<rect x={M.left + i * slot} y={M.top} width={slot} height={plotH} fill="transparent">
									<title>{`${s.name}: ${counts[i]}`}</title>
								</rect>
								<rect
									x={M.left + i * slot + (slot - bar) / 2}
									y={H - M.bottom - h}
									width={bar}
									height={Math.max(h, counts[i] > 0 ? 2 : 0)}
									rx="4"
									fill={`url(#${gradId})`}
									className={`fs-chart-bar ${i !== shown ? "fs-chart-bar-muted" : "fs-chart-glow"}`}
									style={{ animationDelay: `${i * 45}ms` }}
								/>
							</g>
						);
					})}
					{ordered.map((s, i) => (
						<text key={`${s._id}-l`} x={M.left + i * slot + slot / 2} y={H - 10} textAnchor="middle" fontSize="11" fill={i === shown ? "#c7d3f2" : "#9aa7c9"}>{short(s.name)}</text>
					))}
					{shown >= 0 && max > 0 && (
						<g pointerEvents="none">
							<line x1={M.left + shown * slot + slot / 2} x2={M.left + shown * slot + slot / 2} y1={M.top} y2={H - M.bottom} stroke="#7c93ff" strokeOpacity="0.5" strokeWidth="1" className="fs-chart-guide" />
							<text x={Math.min(Math.max(M.left + shown * slot + slot / 2, 62), W - 62)} y={12} textAnchor="middle" fontSize="13" fontWeight="600" fill="#edf2ff">
								{ordered[shown].name} · {counts[shown]}
							</text>
						</g>
					)}
				</svg>
			</div>
		</section>
	);
}
