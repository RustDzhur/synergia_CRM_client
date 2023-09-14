"use client";
import Image from "next/image";
import React, { useEffect } from "react";
import {useTranslations} from 'next-intl';
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";
import { IconContext } from "react-icons";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import Loader from "@/app/utils/Loader";
import ToasterNotifications from "@/app/utils/ToasterNotifications";
import { MessageType } from "@/app/types/MessageType";

export default function CurrentUser() {
	const { user, isLoading, isDropDown, toggleDropDown, fetchUser } =
		useCurrentUserStore();
const t = useTranslations('navBar')
	useEffect(() => {
		fetchUser();
	}, [fetchUser]);

	if (isLoading) {
		return <Loader color="#5EA8F5" width="50" height="10" radius="9" />;
	}

	if (!user) {
		return (
			<ToasterNotifications
				type={MessageType.Error}
				message="Error loading user data"
			/>
		);
	}
	return (
		<div
			onClick={toggleDropDown}
			className="flex items-center relative cursor-pointer">
			<div className=" w-50 mr-8 sm:block md:hidden mp:block">
				<Image src={user.imageUrl} alt="user" />
			</div>
			<div className="mr-8">
				<p className="sm:text-14 md-text-16 lg:text-18 font-medium">
					{user.name}
				</p>
			</div>
			<IconContext.Provider value={{ size: "18px" }}>
				{isDropDown ? <RiArrowDownSLine /> : <RiArrowUpSLine />}
			</IconContext.Provider>
			{isDropDown && (
				<ul className="absolute right-0 top-full  bg-headerBackground border-b-switchCompany rounded-b-8">
					<li className="  py-15 px-20 cursor-pointer">
						<p className="font-medium text-16 leading-16 text-black">{t('currentUser.logout')}</p>
					</li>
					<li className="border-t-switchCompany py-15 px-20 cursor-pointer">
						<p className="font-medium text-16 leading-16 text-black">
						{t('currentUser.settings')}
						</p>
					</li>
				</ul>
			)}
		</div>
	);
}
