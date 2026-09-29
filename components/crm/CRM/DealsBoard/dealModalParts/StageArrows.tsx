"use client";
import { stageColor } from "@/utils/stageColors";

interface StageItem {
	_id: string;
	name: string;
	color?: string;
}

interface Props {
	stages: StageItem[];
	activeId: string;
	onPick: (stageId: string) => void;
}

// Стрелки стадий: клик переносит сделку в стадию
export default function StageArrows({ stages, activeId, onPick }: Props) {
	return (
		<div className="fs-scroll mb-20 flex overflow-x-auto pb-6">
			{stages.map((stage, index) => {
				const active = stage._id === activeId;
				return (
					<button
						key={stage._id}
						type="button"
						onClick={() => !active && onPick(stage._id)}
						aria-pressed={active}
						style={{
							backgroundColor: stageColor(stage.color, index),
							clipPath: "polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%)",
						}}
						className={`h-[54px] w-[170px] shrink-0 px-16 text-12 font-semibold md:w-[222px] md:px-24 md:text-13 text-white transition-opacity duration-200 ${
							active ? "opacity-100" : "opacity-60 hover:opacity-80"
						}`}>
						<span className="block truncate">{stage.name}</span>
					</button>
				);
			})}
		</div>
	);
}
