"use client";
import React, { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import Loader from "@/app/utils/Loader";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import useAuthStore from "@/app/store/useAuthStore";

export default function CurrentUser() {
	const { logout } = useAuthStore();
	const router = useRouter();
	const locale = useLocale();
	const handleLogout = () => {
		logout();
		router.replace(`/${locale}`);
	};
	const { user, isLoading, isDropDown, toggleDropDown, fetchUser } =
		useCurrentUserStore();
	const t = useTranslations("navBar");
	useEffect(() => {
		fetchUser();
	}, [fetchUser]);

	if (isLoading) {
		return <Loader color="#5EA8F5" width="50" height="10" radius="9" />;
	}

	if (!user) return null;

	return (
		<div
			onClick={toggleDropDown}
			className="flex items-center relative cursor-pointer">
			<div className=" w-50 mr-8 sm:block md:hidden mp:block">
				<img src={user.avatarUrl} alt="user" width={50} height={50} />
			</div>
			<div className="mr-8">
				<p className="sm:text-14 md-text-16 lg:text-18 font-medium">
					{user.firstname}
				</p>
				<p className="sm:text-14 md-text-16 lg:text-18 font-medium">
					{user.lastname}
				</p>
			</div>
			<IconContext.Provider value={{ size: "18px" }}>
				{isDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
			</IconContext.Provider>
			{isDropDown && (
				<ul className="absolute right-0 top-full  bg-headerBackground border-b-switchCompany rounded-b-8">
					<li className="  py-15 px-20 cursor-pointer" onClick={handleLogout}>
						<p className="font-medium text-16 leading-16 text-black">
							{t("currentUser.logout")}
						</p>
					</li>
					<li className="border-t-switchCompany py-15 px-20 cursor-pointer">
						<p className="font-medium text-16 leading-16 text-black">
							{t("currentUser.settings")}
						</p>
					</li>
				</ul>
			)}
		</div>
	);
}
