"use client";
import { useTranslations } from "next-intl";
import React, { useState } from "react";
import { MdWorkHistory } from "react-icons/md";
import { TbHexagon, TbLink, TbLockAccess } from "react-icons/tb";

// Шестигранник со звеном цепи внутри — иконка Integration из макета
function HexLinkIcon() {
	return (
		<span className="relative inline-block w-[1em] h-[1em]">
			<TbHexagon className="w-full h-full" strokeWidth={1.5} />
			<TbLink className="absolute left-1/2 top-1/2 h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2" />
		</span>
	);
}

// Три карточки на тёмной полосе; активная (по умолчанию первая) — розовая. Меняется при наведении и нажатии.
export default function Advantages() {
    const t = useTranslations('advantages')
	const [active, setActive] = useState(0);
	const items = [
		{ icon: MdWorkHistory, label: t('marketing') },
		{ icon: HexLinkIcon, label: t('integration') },
		{ icon: TbLockAccess, label: t('accesbility') },
	];
	return (
		<div className="text-center md:grid md:grid-cols-3 sm:space-y-20 md:space-y-0 lg:gap-x-20">
			{items.map((item, i) => (
				<div
					key={i}
					onMouseEnter={() => setActive(i)}
					onClick={() => setActive(i)}
					className={`cursor-pointer rounded-16 text-white sm:text-20 lg:text-24 font-medium tracking-[0.5px] lg:tracking-[1px] transition-[background-color,box-shadow] duration-300 flex flex-col items-center justify-center sm:h-[160px] lg:h-[186px] ${
						active === i ? "bg-authBtn shadow-advantages" : ""
					}`}>
					<div className="text-[40px] lg:text-[50px] leading-none sm:mb-16 lg:mb-[27px] flex justify-center">
						<item.icon />
					</div>
					{item.label}
				</div>
			))}
		</div>
	);
}
