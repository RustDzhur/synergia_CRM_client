"use client";
import React from "react";

interface Props {
	open: boolean;
	className?: string;
	children: React.ReactNode;
}

// Плавное раскрытие/сворачивание блока по высоте (подменю, формы добавления).
// Анимируется grid-template-rows 0fr -> 1fr, поэтому высота содержимого заранее не нужна.
// В открытом состоянии видимость намеренно НЕ задаётся явно (visible), а наследуется от родителя: иначе раскрытое подменю
// осталось бы видимым и кликабельным внутри скрытого контейнера (например, закрытого мобильного меню) и «съедало» нажатия.
export default function Collapse({ open, className = "", children }: Props) {
	return (
		<div
			aria-hidden={!open}
			className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out motion-reduce:transition-none ${
				open ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
			} ${className}`}>
			<div className="min-h-0 overflow-hidden">{children}</div>
		</div>
	);
}
