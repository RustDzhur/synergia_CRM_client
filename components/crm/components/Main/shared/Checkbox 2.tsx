import React from "react";
import { MdCheck } from "react-icons/md";

interface Props {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
}

// Чекбокс из макета таблиц: квадрат 20px, отмеченный — синий с галочкой.
export default function Checkbox({ checked, onChange, label }: Props) {
	return (
		<label className="relative inline-flex h-20 w-20 cursor-pointer items-center justify-center" aria-label={label}>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
			/>
			<span
				className={`flex h-20 w-20 items-center justify-center rounded-4 border-2 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#5EA8F5] ${
					checked ? "border-[#5EA8F5] bg-[#5EA8F5]" : "border-[#999999] bg-white"
				}`}>
				<MdCheck size={16} className={`text-white transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0"}`} />
			</span>
		</label>
	);
}
