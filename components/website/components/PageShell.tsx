import React from "react";

// Общая оболочка внутренних страниц лендинга: ширина как у главной, заголовок и вводный абзац по стилю макета
export default function PageShell({ title, intro, center = false, children }: { title: string; intro?: string; center?: boolean; children: React.ReactNode }) {
	return (
		// цвет текста задаём здесь: страница тёмная, и любой элемент без своего цвета иначе унаследовал бы
		// чёрный и стал бы нечитаемым (именно так и вышло на странице «О нас»)
		<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 md:px-20 lg:px-100 sm:pb-50 lg:pb-[100px] min-h-[55vh] text-[#f1f4ee]">
			<h1 className={`text-24 lg:text-36 font-medium text-[#f1f4ee] tracking-[0.48px] lg:tracking-[1px] leading-[1.4] mb-20 lg:mb-30 ${center ? "text-center" : ""}`}>{title}</h1>
			{intro && <p className={`text-16 lg:text-18 leading-[1.7] tracking-[0.4px] text-[#f1f4ee] max-w-[760px] mb-30 lg:mb-[50px] ${center ? "mx-auto text-center" : ""}`}>{intro}</p>}
			{children}
		</div>
	);
}
