"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { useForm, SubmitHandler } from "react-hook-form";
import { TbSearch } from "react-icons/tb";
import { useSearchStore } from "@/store/useSearchStore";

interface Inputs {
	search: string;
}

// Глобальный поиск в шапке: узкое поле 240px, иконка внутри справа.
export default function Search() {
	const { setQuery, searchData, fetchSearchData } = useSearchStore();
	const t = useTranslations("navBar");

	const {
		register,
		handleSubmit,
	} = useForm<Inputs>();

	const onSubmit: SubmitHandler<Inputs> = (data) => {
		setQuery(data.search);
		fetchSearchData();
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="relative">
			<input
				{...register("search")}
				placeholder={t("search")}
				aria-label={t("search")}
				className="fs-field h-34 w-240 rounded-9 pl-12 pr-34 text-13 outline-none"
			/>
			<span className="pointer-events-none absolute inset-y-0 right-11 flex items-center text-[#9AA396]">
				<TbSearch size={16} />
			</span>
			{searchData.map((result) => (
				//Here I should make styles
				<div key={result}>{result}</div>
			))}
		</form>
	);
}
