import React from "react";
import { TbCheck } from "react-icons/tb";

interface Props {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
}

// Чекбокс в таблицах: квадрат 18px, отмеченный — салатовый с тёмной галочкой.
export default function Checkbox({ checked, onChange, label }: Props) {
	return (
		<label className="relative inline-flex h-18 w-18 cursor-pointer items-center justify-center" aria-label={label}>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
			/>
			<span
				className={`flex h-18 w-18 items-center justify-center rounded-5 border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[#c6ff4d] ${
					checked ? "border-[#c6ff4d] bg-[#c6ff4d]" : "border-[rgba(255,255,255,0.20)] bg-transparent"
				}`}>
				<TbCheck size={14} className={`text-[#0a0c0b] transition-opacity duration-150 ${checked ? "opacity-100" : "opacity-0"}`} />
			</span>
		</label>
	);
}
