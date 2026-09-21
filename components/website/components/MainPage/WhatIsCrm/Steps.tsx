"use client";
import useStepStore from "@/app/store/useStepStore";
import { useTranslations } from "next-intl";
import React from "react";

// Линия времени слева от карточек (десктоп): точки и звенья светлеют от первого шага к последнему.
// Координаты — из макета: точки чередуются справа и слева, шаг по вертикали 145px.
const DOTS = [
	{ x: 88, y: 58, color: "#313D45" },
	{ x: 21, y: 203, color: "#CCCCCC" },
	{ x: 88, y: 348, color: "#E6E6E6" },
	{ x: 21, y: 493, color: "#F1F1F1" },
];

export default function Steps() {
    const { clickedStep, setClickedStep } = useStepStore();
	const t = useTranslations ("whatIsCrm.steps")
	const steps = [
		t("createaccount"),
		t("access"),
		t("createtask"),
		t("enjoy"),
	];
	// по умолчанию (текст «что такое CRM» без выбранного шага) подсвечен первый шаг — так в макете
	const current = clickedStep === 10 ? 0 : clickedStep;
	return (
		<div className="hidden lg:block relative w-448">
			<svg className="absolute top-0 -left-[100px] pointer-events-none" width="100" height="560" viewBox="0 0 100 560" aria-hidden="true">
				<defs>
					{DOTS.slice(0, -1).map((d, i) => (
						<linearGradient key={i} id={`stepLine${i}`} gradientUnits="userSpaceOnUse" x1={d.x} y1={d.y} x2={DOTS[i + 1].x} y2={DOTS[i + 1].y}>
							<stop offset="0" stopColor={d.color} />
							<stop offset="1" stopColor={DOTS[i + 1].color} />
						</linearGradient>
					))}
				</defs>
				{DOTS.slice(0, -1).map((d, i) => (
					<line key={i} x1={d.x} y1={d.y} x2={DOTS[i + 1].x} y2={DOTS[i + 1].y} stroke={`url(#stepLine${i})`} strokeWidth="4" strokeLinecap="round" />
				))}
				{DOTS.map((d, i) => (
					<circle key={i} cx={d.x} cy={d.y} r="10" fill={i === current ? "#313D45" : d.color} className="transition-[fill] duration-300" />
				))}
			</svg>
			{steps.map((step, index) => (
				<div
					key={index}
					className={`px-30 pt-[13px] rounded-16 w-400 mb-30 cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.12)] transition-colors duration-300 ${
						index === steps.length - 1 ? "h-[88px]" : "h-[115px]"
					} ${
						current === index
							? "bg-whatIsCrmActive text-white"
							: "bg-whatIsCrm hover:bg-whatIsCrmActive text-[#666666] hover:text-white"
					} ${index % 2 === 0 ? "ml-auto" : "mr-auto"}`}
					onClick={() => setClickedStep(index)}>
					<p className="text-24 font-medium leading-[34px] tracking-[0.5px]">
						{t("step")} {index + 1}
					</p>
					<p className="text-16 leading-[27px] tracking-[0.4px] mt-[5px]">
						{step}
					</p>
				</div>
			))}
		</div>
	);
}
