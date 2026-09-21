"use client";
import React from "react";
import { useTranslations } from "next-intl";
import type { Stage } from "@/app/store/useCrmStore";
import { stageColor } from "@/app/utils/stageColors";

interface Props {
	stages: Stage[];
	selected: string | null;
	onSelect: (id: string | null) => void;
	onAdd: (stageId: string) => void;
}

const ARROW = 20; // глубина острия стрелки, px

// Цепочка этапов сделок из CRM (цвета — как на доске сделок) и под каждым этапом кнопка «Add» — новое правило для этапа.
// Нажатие на этап выбирает его: ниже показываются правила этого этапа; повторное нажатие снимает выбор.
export default function StagePipeline({ stages, selected, onSelect, onAdd }: Props) {
	const t = useTranslations("automation");
	if (stages.length === 0) {
		return <p className="mb-30 rounded-8 bg-[#F5F7FC] p-16 text-center text-16 text-[#999999]">{t("noStages")}</p>;
	}
	return (
		<div className="-mx-16 mb-30 overflow-x-auto px-16 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0">
			<ol className="flex w-max gap-[2px]">
				{stages.map((s, i) => {
					const active = selected === s._id;
					return (
						<li key={s._id} className="w-[180px] shrink-0 md:w-[192px] lg:w-[222px]">
							<button
								type="button"
								onClick={() => onSelect(active ? null : s._id)}
								aria-pressed={active}
								title={s.name}
								style={{
									background: stageColor(s.color, i),
									clipPath: `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%)`,
								}}
								className="flex h-[55px] w-full items-center justify-center px-16 pr-30 text-16 font-medium text-white transition-[filter] duration-200 hover:brightness-95 lg:text-18">
								<span className="truncate">{s.name}</span>
							</button>
							<div className="pr-10">
								<button
									type="button"
									onClick={() => onAdd(s._id)}
									className={`mt-8 h-[52px] w-full rounded-8 bg-[#F5F7FC] text-16 font-semibold transition-[color,opacity] duration-200 hover:text-primaryColor lg:text-18 ${
										active || (!selected && i === 0) ? "text-[#666666]" : "text-[#CCCCCC] opacity-70"
									}`}>
									{t("add")}
								</button>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
