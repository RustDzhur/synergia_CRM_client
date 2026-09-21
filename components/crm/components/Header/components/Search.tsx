"use client";
import React from "react";
import {useTranslations} from 'next-intl';
import { useForm, SubmitHandler } from "react-hook-form";
import { AiOutlineSearch } from "react-icons/ai";
import { IconContext } from "react-icons";
import { useSearchStore } from "@/app/store/useSearchStore";

interface Inputs {
	search: string;
}

export default function Search() {
	const { query, setQuery, searchData, fetchSearchData } = useSearchStore();
	const t = useTranslations('navBar');

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<Inputs>();

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		setQuery(data.search);
		fetchSearchData();
	};

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="flex items-center rounded-8 shadow-custom">
			<div className="relative">
				<input
					{...register("search")}
					placeholder={t('search')}
					className="h-50 px-20 pr-40 focus:outline-none font-normal lg:text-18 md:text-16 lg:w-350 md:w-300 bg-[#FBFBFB] text-[#B3B3B3] rounded-8"
				/>
				<div className="absolute inset-y-0 right-15 flex items-center pointer-events-none">
					<IconContext.Provider value={{ color: "#B3B3B3", size: "20px" }}>
						<AiOutlineSearch />
					</IconContext.Provider>
				</div>
			</div>
			{searchData.map((result) => (
				//Here I should make styles
				<div key={result}>{result}</div>
			))}
		</form>
	);
}
