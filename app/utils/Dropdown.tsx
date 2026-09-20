"use client";
import React from "react";

interface Props {
	open: boolean;
	// позиционирование задаёт вызывающий код: "right-0 top-full mt-[8px]" и т.п.
	className?: string;
	children: React.ReactNode;
}

// Выпадающая панель с плавным появлением/исчезновением (прозрачность + сдвиг + лёгкое масштабирование).
// Элемент всегда в DOM, поэтому анимируется и закрытие. В закрытом состоянии он невидим для
// мыши и клавиатуры (visibility: hidden срабатывает в конце анимации).
export default function Dropdown({ open, className = "", children }: Props) {
	return (
		<div
			aria-hidden={!open}
			className={`absolute z-30 origin-top transition-[opacity,transform,visibility] duration-200 ease-out motion-reduce:transition-none ${
				open
					? "visible opacity-100 translate-y-0 scale-100"
					: "invisible opacity-0 -translate-y-[8px] scale-95 pointer-events-none"
			} ${className}`}>
			{children}
		</div>
	);
}
