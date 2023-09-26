"use client";
import React, { useState } from "react";
import { IconContext } from "react-icons";
import { AiFillCheckCircle } from "react-icons/ai";
import free from "@/app/assets/svgs/plans/free.svg";
import basic from "@/app/assets/svgs/plans/basic.svg";
import standart from "@/app/assets/svgs/plans/standart.svg";
import professional from "@/app/assets/svgs/plans/professional.svg";
import Image from "next/image";

export default function PaidPlan() {
	const [active, setActive] = useState("Month");
	const toggleActiveTab = (active: string) => {
		setActive(active);
	};
	return (
		<div>
			<h2 className="text-24 lg:text-36 font-bold text-center mb-30 lg:mb-60 text-textChoosePlan leading-[1.4] tracking-[0.48px]">
				Choose Your Plan
			</h2>
			<div className="flex justify-center mb-40">
				<div className="shadow-choosePlan rounded-50 inline-flex items-center justify-center ">
					<div
						className={`w-175 h-50 text-center flex items-center justify-center rounded-50 cursor-pointer ${
							active === "Month"
								? "bg-tabChoosePlan text-white"
								: "bg-white text-[#CCCCCC]"
						} font-bold text-18 `}
						onClick={() => toggleActiveTab("Month")}>
						Month
					</div>
					<div
						className={`w-175 h-50 text-center flex items-center justify-center rounded-50 cursor-pointer ${
							active === "Year"
								? "bg-tabChoosePlan text-white"
								: "bg-white text-[#CCCCCC]"
						} font-bold text-18 `}
						onClick={() => toggleActiveTab("Year")}>
						Year
					</div>
				</div>
			</div>
			<div className="overflow-x-scroll scroll-mb-30 flex space-x-4">
				<div className="p-25 shadow-choosePlan rounded-16 inline-flex flex-shrink-0  flex-col mb-10 mr-20 ml-10">
					<div className="mb-40">
						<Image src={free} alt="free" width={50} className="mb-12" />
						<p className="text-20 text-textChoosePlan tracking-[0.4px]">Free</p>
					</div>
					<div className="mb-40">
						<p className="text-40 text-textChoosePlan tracking-[0.8px] mb-6">
							Free
						</p>
						<p className="text-[#999999] text-16 tracking-[0.32px]">
							Unlimited Users Trial 6 months
						</p>
					</div>
					<div className="mb-40">
						<IconContext.Provider value={{ size: "22px", color: "#313D45" }}>
							<ul className="text-18 font-medium tracking-[0.36px]">
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Chat</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>HD Video Calls</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Calendar</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Company Workspace</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Feed</p>
								</li>
								<li className="flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Knowledge Base</p>
								</li>
							</ul>
						</IconContext.Provider>
					</div>
					<div className="border-cardPlan rounded-8 text-center py-16 cursor-pointer hover:bg-tabChoosePlan text-tabChoosePlan hover:text-white tracking-[0.36px] font-bold">
						Choose Plan
					</div>
				</div>
				<div className="p-25 shadow-choosePlan rounded-16 inline-flex flex-shrink-0 flex-col mb-10 mr-20">
					<div className="mb-40">
						<Image src={free} alt="free" width={50} className="mb-12" />
						<p className="text-20 text-textChoosePlan tracking-[0.4px]">Free</p>
					</div>
					<div className="mb-40">
						<p className="text-40 text-textChoosePlan tracking-[0.8px] mb-6">
							Free
						</p>
						<p className="text-[#999999] text-16 tracking-[0.32px]">
							Unlimited Users Trial 6 months
						</p>
					</div>
					<div className="mb-40">
						<IconContext.Provider value={{ size: "22px", color: "#313D45" }}>
							<ul className="text-18 font-medium tracking-[0.36px]">
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Chat</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>HD Video Calls</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Calendar</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Company Workspace</p>
								</li>
								<li className="mb-18 flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Feed</p>
								</li>
								<li className="flex items-center">
									<div className="mr-8">
										<AiFillCheckCircle />
									</div>
									<p>Knowledge Base</p>
								</li>
							</ul>
						</IconContext.Provider>
					</div>
					<div className="border-cardPlan rounded-8 text-center py-16 cursor-pointer hover:bg-tabChoosePlan text-tabChoosePlan hover:text-white tracking-[0.36px] font-bold">
						Choose Plan
					</div>
				</div>
			</div>
		</div>
	);
}
