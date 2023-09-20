"use client";
import { useTranslations } from "next-intl";
import React from "react";
import { IconContext } from "react-icons";
import { GiCardExchange } from "react-icons/gi";
import { MdOutlineIntegrationInstructions } from "react-icons/md";
import { TbLockAccess } from "react-icons/tb";

export default function Advantages() {
    const t = useTranslations('advantages')
	return (
		<div className="text-center">
			<IconContext.Provider value={{ size: "40px", color: "#ffffff" }}>
				<div className="md:flex justify-between">
					<div className="shadow-advantages rounded-16 py-40 text-white sm:text-20 sm:font-bold hover:bg-authBtn md:w-[100%]">
						<div className="flex justify-center sm:mb-16">
							<GiCardExchange />
						</div>
						{t('marketing')}
					</div>
					<div className="shadow-advantages rounded-16 py-40 text-white sm:text-20 sm:font-bold hover:bg-authBtn md:w-[100%]">
						<div className="flex justify-center sm:mb-16">
							<MdOutlineIntegrationInstructions />
						</div>
						{t('integration')}
					</div>
					<div className="shadow-advantages rounded-16 py-40 text-white sm:text-20 sm:font-bold hover:bg-authBtn md:w-[100%]">
						<div className="flex justify-center sm:mb-16">
							<TbLockAccess />
						</div>
						{t('accesbility')}
					</div>
				</div>
			</IconContext.Provider>
		</div>
	);
}
