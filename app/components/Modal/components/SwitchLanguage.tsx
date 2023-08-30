"use client";
import React, { useState } from "react";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import ukraine from "@/app/assets/svgs/ukraine-flag-icon.svg";
import usa from "@/app/assets/svgs/united-states-flag-icon.svg";
import germany from "@/app/assets/svgs/germany-flag-icon.svg";

const flags: Flag[] = [
	{ url: usa, name: "United States", width: 40, height: 30 },
	{ url: germany, name: "Germany", width: 40, height: 30 },
	{ url: ukraine, name: "Ukraine", width: 40, height: 30 },
];

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const [selectedFlag, setSelectedFlag] = useState(flags[0]);

	const avalableFlags = flags.filter((flag) => flag.url !== selectedFlag.url);

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

	const handleFlagChange = (flag: Flag) => {
		setSelectedFlag(flag);
		setIsOpenDropDown(false);
	};

	return (
		<div>
			<div onClick={handleOpenDropDown} className="mb-30 sm:p-20 md:p-0 ">
				<div className="flex items-center justify-between pl-12 pr-12 mb-24">
					<p> Language</p>
					<div className="flex items-center">
						<Image
							src={selectedFlag.url}
							alt="selected-flag"
							width={selectedFlag.width}
							height={selectedFlag.height}
							className="w-40 cursor-pointer mr-6"
						/>
						<div>
							<IconContext.Provider value={{ size: "18px", color: "#999999" }}>
								{isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
							</IconContext.Provider>
						</div>
					</div>
				</div>

				{isOpenDropDown ? (
					<ul className="">
						{avalableFlags.map((flag, index) => (
							<li
								onClick={() => handleFlagChange(flag)}
								key={uuidv4()}
								className={`${
									isOpenDropDown ? "lg:mt-6" : ""
								} cursor-pointer flex items-center justify-between ${
									index !== avalableFlags.length - 1 ? "mb-20" : ""
								}`}>
								<p>{flag.name}</p>
								<Image
									src={flag.url}
									alt={flag.name}
									width={flag.width}
									height={flag.height}
								/>
							</li>
						))}
					</ul>
				) : null}
			</div>
		</div>
	);
}
