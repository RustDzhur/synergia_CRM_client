import React from "react";
import { TbAdjustments, TbSearch } from "react-icons/tb";

interface Props {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	// показывать значок фильтра справа от лупы
	withFilter?: boolean;
	className?: string;
}

// Поле поиска раздела: лупа слева, тёмная заливка и тонкая рамка (в фокусе — салатовая).
// Высота 46px — как в образце, где поиск стоит отдельной строкой над списком.
export default function SearchBox({ value, onChange, placeholder, withFilter = true, className = "" }: Props) {
	return (
		<div className={`fs-field flex h-46 items-center gap-10 rounded-10 px-14 transition-colors ${className}`}>
			<TbSearch size={17} className="shrink-0 text-[#9AA396]" />
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className="w-full min-w-0 bg-transparent text-14 text-[#f1f4ee] outline-none placeholder:text-[#9AA396]"
			/>
			{withFilter && <TbAdjustments size={17} className="shrink-0 text-[#9AA396]" />}
		</div>
	);
}
