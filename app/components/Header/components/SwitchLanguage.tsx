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
		<div className="flex items-center">
			<div className="relative" onClick={handleOpenDropDown}>
				<Image
					src={selectedFlag.url}
					alt="selected-flag"
					width={selectedFlag.width}
					height={selectedFlag.height}
					className="w-40 cursor-pointer"
				/>
				{isOpenDropDown ? (
						<ul className="hidden lg:block lg:absolute lg:top-full">
							{avalableFlags.map((flag) => (
								<li
									onClick={() => handleFlagChange(flag)}
									key={uuidv4()}
									className={`${
										isOpenDropDown ? "lg:mt-6" : ""
									} cursor-pointer`}>
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
			<div>
				<IconContext.Provider value={{ size: "18px", color: "#999999" }}>
					{isOpenDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
				</IconContext.Provider>
			</div>
		</div>
	);
}
