"use client";
import useStepStore from "@/app/store/useStepStore";
import React from "react";

export default function Steps() {
    const { clickedStep, setClickedStep } = useStepStore();
	const steps = [
		"Create your account and sign in",
		"Access the dashboard",
		"Create tasks and read the feed",
		"Enjoy the application!",
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
							Step {index + 1}
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
