"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MdChevronRight } from "react-icons/md";
import { TAB_BAR, TAB_ITEM, TAB_ITEM_ACTIVE, TAB_ITEM_IDLE } from "../../tabBar";

const HIDE_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

interface Props { tabs: string[]; active: string; onChange: (tab: string) => void; label: (tab: string) => string }

// Список вкладок шире экрана: активная вкладка выезжает в видимую область, справа стрелка «дальше»
export default function TabBar({ tabs, active, onChange, label }: Props) {
	const tr = useTranslations("records");
	const [canScrollRight, setCanScrollRight] = useState(false);
	const barRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		barRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
	}, [active]);
	useEffect(() => {
		const bar = barRef.current;
		if (!bar) return;
		const update = () => setCanScrollRight(bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4);
		update();
		bar.addEventListener("scroll", update, { passive: true });
		const ro = new ResizeObserver(update);
		ro.observe(bar);
		return () => { bar.removeEventListener("scroll", update); ro.disconnect(); };
	}, []);

	return (
		<div className="relative min-w-0">
			<div ref={barRef} role="tablist" className={`${TAB_BAR} overflow-x-auto ${HIDE_SCROLLBAR}`}>
				{tabs.map((key) => (
					<button
						key={key}
						type="button"
						role="tab"
						aria-selected={active === key}
						onClick={() => onChange(key)}
						className={`${TAB_ITEM} ${active === key ? TAB_ITEM_ACTIVE : TAB_ITEM_IDLE}`}>
						{label(key)}
					</button>
				))}
			</div>
			{canScrollRight && (
				<button
					type="button"
					aria-label={tr("scrollTabs")}
					onClick={() => barRef.current?.scrollBy({ left: 160, behavior: "smooth" })}
					className="absolute right-0 top-1/2 hidden h-34 w-34 -translate-y-1/2 items-center justify-center rounded-50 bg-[rgba(255,255,255,0.06)] text-[#8c948b] transition-colors hover:text-[#f1f4ee] md:flex">
					<MdChevronRight size={20} />
				</button>
			)}
		</div>
	);
}
