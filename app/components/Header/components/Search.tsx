"use client";
import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { AiOutlineSearch } from "react-icons/ai";
import { IconContext } from "react-icons";

export default function Search() {
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors },
	} = useForm<Inputs>();
	const onSubmit: SubmitHandler<Inputs> = (data) => console.log(data);
	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className="flex items-center rounded-8 shadow-custom">
			<div className="relative">
				<input
					{...register("example")}
                    placeholder="Search"
					className=" py-15 px-20 pr-40 focus:outline-none font-normal text-18 w-350"
					style={{ background: "#FBFBFB", color: '#B3B3B3', borderRadius: "8px" }}
				/>
				<div className="absolute inset-y-0 right-15 flex items-center pointer-events-none">
					<IconContext.Provider value={{ color: "#B3B3B3", size: "20px" }}>
						<AiOutlineSearch />
					</IconContext.Provider>
				</div>
			</div>
		</form>
	);
}
