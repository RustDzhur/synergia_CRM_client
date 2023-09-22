"use client";
import useStepStore from "@/app/store/useStepStore";
import { useTranslations } from "next-intl";
import React from "react";

export default function Steps() {
    const { clickedStep, setClickedStep } = useStepStore();
	const t = useTranslations ("whatIsCrm.steps")
	const steps = [
		t("createaccount"),
		t("access"),
		t("createtask"),
		t("enjoy"),
	];
	return (
		<div className="hidden lg:flex flex-col w-448">
			{steps.map((step, index) => (
				<div
					key={index}
					className={`flex items-${
						index % 2 === 0 ? "end" : "start"
					} px-30 py-10 rounded-16 w-400 mb-30 cursor-pointer ${
						clickedStep === index
							? "bg-whatIsCrmActive text-white"
							: "bg-whatIsCrm hover:bg-whatIsCrmActive text-whatIsCrmActive hover:text-white"
					} ${index % 2 === 0 ? "ml-auto" : "mr-auto"}`}
					onClick={() => setClickedStep(index)}>
					<div>
						<p className="text-24 font-bold leading-[1.7] tracking-[0.48px]">
							{t("step")} {index + 1}
						</p>
						<p className="text-16 font-medium leading-[1.7] tracking-[0.32px]">
							{step}
						</p>
					</div>
				</div>
			))}
		</div>
	);
}
