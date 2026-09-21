"use client";
import React from "react";
import Steps from "./Steps";
import useStepStore from "@/app/store/useStepStore";
import { useTranslations } from "next-intl";

export default function WhatIsCrm() {
	const { clickedStep } = useStepStore();
	const t = useTranslations("whatIsCrm");
	const stepContentFirst = [
		{
			text: t("stepContentFirst.step1"),
		},
		{
			text: t("stepContentFirst.step2"),
		},
		{
			text: t("stepContentFirst.step3"),
		},
		{
			text: t("stepContentFirst.step4"),
		},
	];

	const stepContentSecond = [
		{
			text: t("stepContentSecond.step1"),
		},
		{
			text: t("stepContentSecond.step2"),
		},
		{
			text: t("stepContentSecond.step3"),
		},
		{
			text: t("stepContentSecond.step4"),
		},
	];
	return (
		<div className="flex justify-between sm:text-center lg:text-left text-whatIsCrmActive">
			<div className="lg:w-610">
				<h2 className="sm:text-24 sm:mb-20 lg:mb-[41px] lg:text-36 font-medium leading-[1.4] sm:tracking-[0.48px] lg:tracking-[1px]">
					{t('whatIsCrm')}
				</h2>
				<div className="sm:text-16 lg:text-18 leading-[1.7] lg:leading-[31px] tracking-[0.4px] sm:mb-40 md:mb-[27px] lg:mb-[31px]">
					{clickedStep === 10 &&
						t("defaultTextFirst")}
					{stepContentFirst.map(
						(step, index) =>
							clickedStep === index && <p key={index}>{step.text}</p>
					)}
				</div>
				<div className="sm:text-16 lg:text-18 leading-[1.7] lg:leading-[31px] tracking-[0.4px]">
					{clickedStep === 10 &&
						t("defaultTextSecond")}
					{stepContentSecond.map(
						(step, index) =>
							clickedStep === index && <p key={index}>{step.text}</p>
					)}
				</div>
			</div>
			<Steps />
		</div>
	);
}
