import React from "react";
import { MdSearch, MdTune } from "react-icons/md";

interface Props {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	// показывать значок фильтра «≡» справа от лупы
	withFilter?: boolean;
	className?: string;
}

// Поле поиска из макета: белое, рамка 2px #E6E6E6 (в фокусе синяя), справа лупа и значок фильтра.
export default function SearchBox({ value, onChange, placeholder, withFilter = true, className = "" }: Props) {
	return (
		<div
			className={`flex h-[50px] items-center justify-between rounded-8 border-2 border-[#E6E6E6] bg-white px-16 shadow-custom transition-colors focus-within:border-[#5EA8F5] ${className}`}>
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className="w-full min-w-0 text-16 text-[#666666] outline-none placeholder:text-[#CCCCCC] lg:text-18"
			/>
			<div className="flex shrink-0 items-center gap-10 text-[#CCCCCC]">
				<MdSearch size={20} />
				{withFilter && <MdTune size={20} />}
			</div>
		</div>
	);
}
