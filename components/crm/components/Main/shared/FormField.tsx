import React from "react";

// Поля форм по макету: серая подпись сверху, светлое поле со скруглением и лёгкой тенью.
export const fieldClass =
	"h-[40px] w-full rounded-8 border border-[#EFEFEF] bg-[#FAFAFA] px-10 text-16 text-[#666666] shadow-custom outline-none transition-colors duration-200 placeholder:text-[#CCCCCC] focus:border-[#5EA8F5]";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
	wrapperClassName?: string;
}

export default function FormField({ label, wrapperClassName = "", className = "", ...rest }: Props) {
	return (
		<label className={`block ${wrapperClassName}`}>
			<span className="mb-6 block text-16 text-[#999999]">{label}</span>
			<input className={`${fieldClass} ${className}`} {...rest} />
		</label>
	);
}
