"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { TbChevronDown, TbLogout, TbSettings, TbShieldCog } from "react-icons/tb";
import Link from "next/link";
import { useCurrentUserStore } from "@/store/useCurrentUserStore";
import useAuthStore from "@/store/useAuthStore";
import Loader from "@/utils/Loader";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import Avatar from "@/components/crm/shared/Avatar";

interface Props {
	// В мобильном меню аватар показывается всегда, в шапке — только с 900px.
	// В мобильном меню список открывается вверх, чтобы не упираться в край панели.
	showAvatar?: boolean;
}

export default function CurrentUser({ showAvatar = false }: Props) {
	const { logout } = useAuthStore();
	const router = useRouter();
	const locale = useLocale();
	const { user, isLoading, openProfile, fetchUser } = useCurrentUserStore();
	const t = useTranslations("navBar");
	// Состояние меню — своё у каждого экземпляра: CurrentUser рендерится и в шапке, и в мобильном меню,
	// а общий флаг в сторе открывал оба сразу, и «клик снаружи» от невидимого экземпляра закрывал меню
	// того, по которому как раз кликнули (mousedown закрывает → mouseup/click уже мимо пункта).
	const [open, setOpen] = useState(false);
	const closeMenu = useCallback(() => setOpen(false), []);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		fetchUser();
	}, [fetchUser]);

	useClickOutside(rootRef, open, closeMenu);

	const handleLogout = () => {
		closeMenu();
		logout();
		router.replace(`/${locale}`);
	};

	if (isLoading) {
		return <Loader color="#c6ff4d" width="50" height="10" radius="9" />;
	}

	if (!user) return null;

	const initials = `${user.firstname?.[0] ?? ""}${user.lastname?.[0] ?? ""}`.toUpperCase();
	const menuItem =
		"fs-popover-row flex w-full items-center gap-10 px-14 py-10 text-left text-13 font-medium transition-colors duration-150";

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="flex items-center cursor-pointer">
				{/* Аватар: серый круг 50px (#D9D9D9); на 768px в Figma его нет */}
				<Avatar
					src={user.avatarUrl}
					initials={initials}
					size={50}
					className={`${showAvatar ? "flex" : "hidden mp:flex"} mr-10 text-16 shadow-circleShadow`}
				/>
				<p className="max-w-[100px] lg:max-w-[130px] truncate text-13 lg:text-14 font-medium text-[#f1f4ee] whitespace-nowrap">
					{user.firstname} {user.lastname}
				</p>
				<TbChevronDown
					size={16}
					className={`ml-6 shrink-0 text-[#8c948b] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
				/>
			</button>

			<Dropdown
				open={open}
				className={`w-[200px] ${
					showAvatar ? "bottom-full left-0 mb-[8px] origin-bottom" : "right-0 top-full mt-[8px]"
				}`}>
				<div className="fs-popover overflow-hidden">
					<button type="button" onClick={() => { closeMenu(); openProfile(); }} className={menuItem}>
						<TbSettings size={17} className="shrink-0 text-[#8c948b]" />
						{t("currentUser.settings")}
					</button>
					{user.isAdmin && (
						<>
							<div className="border-t border-inkLine" />
							<Link href={`/${locale}/crm/admin`} onClick={closeMenu} className={menuItem}>
								<TbShieldCog size={17} className="shrink-0 text-[#8c948b]" />
								{t("adminCabinet")}
							</Link>
						</>
					)}
					<div className="border-t border-inkLine" />
					<button type="button" onClick={handleLogout} className={menuItem}>
						<TbLogout size={17} className="shrink-0 text-[#8c948b]" />
						{t("currentUser.logout")}
					</button>
				</div>
			</Dropdown>
		</div>
	);
}
