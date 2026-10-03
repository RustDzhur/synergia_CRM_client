"use client";

export interface PairBar { label: string; a: number; b: number; titleA: string; titleB: string }

// Парные столбики «доход / расходы» по периодам, которые подстраиваются под ширину блока: колонки делят всю ширину поровну,
// столбики — доля колонки (не фиксированные пиксели), высота растёт вместе с шириной экрана. На очень узком экране колонкам
// остаётся минимальная ширина, и график прокручивается по горизонтали, а не сжимается в кашу.
// compact — карточка на главной (ниже), иначе — разделы Финансов.
export default function PairBars({ data, compact = false }: { data: PairBar[]; compact?: boolean }) {
	const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
	const plot = compact ? "h-[clamp(96px,11vw,170px)]" : "h-[clamp(120px,16vw,260px)]";
	return (
		<div className="fs-scroll overflow-x-auto pb-2">
			<div className="flex w-full items-end gap-[clamp(3px,0.8vw,14px)]" style={{ minWidth: `${data.length * 30}px` }}>
				{data.map((d, i) => (
					<div key={`${d.label}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-4">
						<div className={`flex w-full items-end justify-center gap-[2px] ${plot}`}>
							<div className="w-[40%] max-w-[26px] rounded-t-[3px] bg-[#c6ff4d]" style={{ height: `${Math.max(2, (d.a / max) * 100)}%` }} title={d.titleA} />
							<div className="w-[40%] max-w-[26px] rounded-t-[3px] bg-[#8C948B]" style={{ height: `${Math.max(2, (d.b / max) * 100)}%` }} title={d.titleB} />
						</div>
						<span className="text-11 text-[#9AA396]">{d.label}</span>
					</div>
				))}
			</div>
		</div>
	);
}
