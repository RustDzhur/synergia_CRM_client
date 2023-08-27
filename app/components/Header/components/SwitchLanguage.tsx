"use client";
import React, { useState } from "react";
import Image from "next/image";
import { v4 as uuidv4 } from 'uuid';
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import ukraine from "@/app/assets/svgs/ukraine-flag-icon.svg";
import usa from "@/app/assets/svgs/united-states-flag-icon.svg";
import germany from "@/app/assets/svgs/germany-flag-icon.svg";

export default function SwitchLanguage() {
	const [isOpenDropDown, setIsOpenDropDown] = useState(false);
	const [selectedFlag, setSelectedFlag] = useState(ukraine);

	const handleOpenDropDown = () => {
		setIsOpenDropDown(!isOpenDropDown);
	};

	const avalableFlags = [usa, germany, ukraine].filter(
		(flag) => flag !== selectedFlag
	);

	const handleFlagChange = (flag: string) => {
		setSelectedFlag(flag);
		setIsOpenDropDown(false);
	};

	return (
		<div className="flex items-center">
			<div className="relative" onClick={handleOpenDropDown}>
				<Image
					src={selectedFlag}
					alt="selected-flag"
					className="w-40 cursor-pointer"
				/>
				{isOpenDropDown ? (
					<ul className="absolute top-full">
						{avalableFlags.map((flag: string) => (
							<li
								onClick={() => handleFlagChange(flag)}
								key={uuidv4()}
								className={`${isOpenDropDown ? "mt-6" : ""} cursor-pointer`}>
								<Image src={flag} alt={flag} />
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
