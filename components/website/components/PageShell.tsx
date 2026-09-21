import React from "react";

// Общая оболочка внутренних страниц лендинга: ширина как у главной, заголовок и вводный абзац по стилю макета
export default function PageShell({ title, intro, center = false, children }: { title: string; intro?: string; center?: boolean; children: React.ReactNode }) {
	return (
		<div className="sm:max-w-screen-sm md:max-w-screen-md lg:max-w-screen-lg m-auto sm:px-12 md:px-20 lg:px-100 sm:pb-50 lg:pb-[100px] min-h-[55vh]">
			<h1 className={`text-24 lg:text-36 font-medium text-discover tracking-[0.48px] lg:tracking-[1px] leading-[1.4] mb-20 lg:mb-30 ${center ? "text-center" : ""}`}>{title}</h1>
			{intro && <p className={`text-16 lg:text-18 leading-[1.7] tracking-[0.4px] text-discover max-w-[760px] mb-30 lg:mb-[50px] ${center ? "mx-auto text-center" : ""}`}>{intro}</p>}
			{children}
		</div>
	);
}
