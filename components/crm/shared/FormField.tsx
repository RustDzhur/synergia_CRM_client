import React from "react";

// Поля форм: приглушённая подпись сверху, тёмное поле с тонкой рамкой (fs-field, см. globals.css).
export const fieldClass = "fs-field h-40 w-full px-12 text-13 outline-none transition-colors";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
	wrapperClassName?: string;
}

export default function FormField({ label, wrapperClassName = "", className = "", ...rest }: Props) {
	return (
		<label className={`block ${wrapperClassName}`}>
			<span className="mb-6 block text-12 text-[#8c948b]">{label}</span>
			<input className={`${fieldClass} ${className}`} {...rest} />
		</label>
	);
}
