"use client";

export interface PairBar { label: string; a: number; b: number; titleA: string; titleB: string; c?: number; titleC?: string }

// Парные столбики «доход / расходы» по периодам, которые подстраиваются под ширину блока: колонки делят всю ширину поровну,
// столбики — доля колонки (не фиксированные пиксели), высота растёт вместе с шириной экрана. На очень узком экране колонкам
// остаётся минимальная ширина, и график прокручивается по горизонтали, а не сжимается в кашу.
// Столбики в стиле сайта: градиент cyan→indigo (доход) и violet→indigo (выставлено), мягкое свечение при наведении,
// при появлении вырастают снизу (анимация замирает при prefers-reduced-motion).
// compact — карточка на главной (ниже), иначе — разделы Финансов.
const GROW = { transformOrigin: "center bottom", animation: "fs-chart-grow 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards" };
const GRAD_A = "linear-gradient(180deg, #22d3ee 0%, #7c93ff 100%)";
const GRAD_C = "linear-gradient(180deg, #a78bfa 0%, #7c93ff 100%)";
const HOVER = "transition-[filter] duration-150 hover:brightness-110 hover:drop-shadow-[0_0_8px_rgba(124,147,255,0.65)]";

export default function PairBars({ data, compact = false }: { data: PairBar[]; compact?: boolean }) {
	const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b, d.c ?? 0]));
	const triple = data.some((d) => d.c !== undefined);
	const barW = triple ? "w-[28%] max-w-[18px]" : "w-[40%] max-w-[26px]";
	const plot = compact ? "h-[clamp(96px,11vw,170px)]" : "h-[clamp(120px,16vw,260px)]";
	return (
		<div className="fs-scroll overflow-x-auto pb-2">
			<div className="flex w-full items-end gap-[clamp(3px,0.8vw,14px)]" style={{ minWidth: `${data.length * 30}px` }}>
				{data.map((d, i) => (
					<div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-4">
						<div className={`flex w-full items-end justify-center gap-[2px] ${plot}`}>
							{triple && <div className={`${barW} ${HOVER} rounded-t-[3px]`} style={{ height: `${Math.max(2, ((d.c ?? 0) / max) * 100)}%`, background: GRAD_C, ...GROW, animationDelay: `${i * 35}ms` }} title={d.titleC} />}
							<div className={`${barW} ${HOVER} rounded-t-[3px]`} style={{ height: `${Math.max(2, (d.a / max) * 100)}%`, background: GRAD_A, ...GROW, animationDelay: `${i * 35}ms` }} title={d.titleA} />
							<div className={`${barW} ${HOVER} rounded-t-[3px] bg-[#9AA7C9]`} style={{ height: `${Math.max(2, (d.b / max) * 100)}%`, ...GROW, animationDelay: `${i * 35}ms` }} title={d.titleB} />
						</div>
						<span className="text-11 text-[#9AA7C9]">{d.label}</span>
					</div>
				))}
			</div>
		</div>
	);
}
