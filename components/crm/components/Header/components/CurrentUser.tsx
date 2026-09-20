"use client";
import React, { useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { RiArrowDownSLine } from "react-icons/ri";
import { MdLogout, MdSettings } from "react-icons/md";
import { useCurrentUserStore } from "@/app/store/useCurrentUserStore";
import useAuthStore from "@/app/store/useAuthStore";
import Loader from "@/app/utils/Loader";
import Dropdown from "@/app/utils/Dropdown";
import { useClickOutside } from "@/app/utils/useClickOutside";
import Avatar from "@/components/crm/components/Main/shared/Avatar";

interface Props {
	// В мобильном меню аватар показывается всегда, в шапке — только с 900px.
	// В мобильном меню список открывается вверх, чтобы не упираться в край панели.
	showAvatar?: boolean;
}

export default function CurrentUser({ showAvatar = false }: Props) {
	const { logout } = useAuthStore();
	const router = useRouter();
	const locale = useLocale();
	const { user, isLoading, isDropDown, toggleDropDown, closeDropDown, openProfile, fetchUser } =
		useCurrentUserStore();
	const t = useTranslations("navBar");
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fetchUser();
	}, [fetchUser]);

	useClickOutside(rootRef, isDropDown, closeDropDown);

	const handleLogout = () => {
		closeDropDown();
		logout();
		router.replace(`/${locale}`);
	};

	if (isLoading) {
		return <Loader color="#5EA8F5" width="50" height="10" radius="9" />;
	}

	if (!user) return null;

	const initials = `${user.firstname?.[0] ?? ""}${user.lastname?.[0] ?? ""}`.toUpperCase();
	const menuItem =
		"flex w-full items-center gap-12 px-16 py-12 text-left text-16 font-medium text-[#666666] transition-colors duration-150 hover:bg-gray";

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-expanded={isDropDown}
				onClick={toggleDropDown}
				className="flex items-center cursor-pointer">
				{/* Аватар: серый круг 50px (#D9D9D9); на 768px в Figma его нет */}
				<Avatar
					src={user.avatarUrl}
					initials={initials}
					size={50}
					className={`${showAvatar ? "flex" : "hidden mp:flex"} mr-10 text-16 shadow-circleShadow`}
				/>
				<p className="max-w-[100px] lg:max-w-[130px] truncate text-16 lg:text-18 font-medium text-black whitespace-nowrap">
					{user.firstname} {user.lastname}
				</p>
				<RiArrowDownSLine
					size={24}
					color="#4D4D4D"
					className={`ml-6 transition-transform duration-200 ${isDropDown ? "rotate-180" : ""}`}
				/>
			</button>

			<Dropdown
				open={isDropDown}
				className={`w-[200px] ${
					showAvatar ? "bottom-full left-0 mb-[8px] origin-bottom" : "right-0 top-full mt-[8px]"
				}`}>
				<div className="overflow-hidden rounded-8 border border-[#E2F1F5] bg-white shadow-custom">
					<button type="button" onClick={openProfile} className={menuItem}>
						<MdSettings size={20} className="text-iconColor" />
						{t("currentUser.settings")}
					</button>
					<div className="border-t border-[#E2F1F5]" />
					<button type="button" onClick={handleLogout} className={menuItem}>
						<MdLogout size={20} className="text-iconColor" />
						{t("currentUser.logout")}
					</button>
				</div>
			</Dropdown>
		</div>
	);
}
