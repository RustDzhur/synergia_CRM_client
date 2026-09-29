"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { TbDots, TbLogout, TbSettings, TbShieldCog } from "react-icons/tb";
import { useCurrentUserStore } from "@/store/useCurrentUserStore";
import useAuthStore from "@/store/useAuthStore";
import Dropdown from "@/utils/Dropdown";
import { useClickOutside } from "@/utils/useClickOutside";
import Avatar from "@/components/crm/components/Main/shared/Avatar";

// Подвал сайдбара: аватар, имя, почта и меню «…» — профиль, кабинет администратора, выход.
export default function SidebarUser({ collapsed = false }: { collapsed?: boolean }) {
	const t = useTranslations("navBar");
	const locale = useLocale();
	const router = useRouter();
	const { logout } = useAuthStore();
	const { user, fetchUser, openProfile } = useCurrentUserStore();
	const [open, setOpen] = useState(false);
	const close = useCallback(() => setOpen(false), []);
	const rootRef = useRef<HTMLDivElement>(null);
	useClickOutside(rootRef, open, close);

	useEffect(() => { fetchUser(); }, [fetchUser]);

	// Пока пользователь не загрузился, на его месте стоит пустая плитка — иначе сайдбар прыгает по высоте
	if (!user) {
		return <div className={collapsed ? "h-40" : "h-[62px]"} aria-hidden />;
	}

	const initials = `${user.firstname?.[0] ?? ""}${user.lastname?.[0] ?? ""}`.toUpperCase();
	const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();
	const row = "fs-popover-row flex w-full items-center gap-10 px-12 py-10 text-left text-13 font-medium transition-colors";

	const handleLogout = () => {
		close();
		logout();
		router.replace(`/${locale}`);
	};

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-expanded={open}
				aria-label={fullName}
				onClick={() => setOpen((v) => !v)}
				className={
					collapsed
						? "flex w-full items-center justify-center py-4"
						: "flex w-full items-center gap-10 rounded-12 px-6 py-6 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
				}>
				<Avatar
					src={user.avatarUrl}
					initials={initials}
					size={collapsed ? 30 : 34}
					className="flex text-12 font-semibold"
					style={user.avatarUrl ? undefined : { background: "linear-gradient(140deg, #c6ff4d, #7fd12f)", color: "#0a0c0b" }}
				/>
				{collapsed ? null : (
					<>
						<span className="min-w-0 flex-1">
							<span className="block truncate text-13 font-medium text-[#f1f4ee]">{fullName}</span>
							<span className="mt-2 block truncate text-11 text-[#9AA396]">{user.email}</span>
						</span>
						<TbDots size={16} className="shrink-0 text-[#8c948b]" />
					</>
				)}
			</button>

			<Dropdown open={open} className={collapsed ? "left-full bottom-0 ml-8 w-200" : "bottom-full left-0 right-0 mb-8"}>
				<div className="fs-popover overflow-hidden py-4">
					<button type="button" onClick={() => { close(); openProfile(); }} className={row}>
						<TbSettings size={17} className="text-[#8c948b]" />
						{t("currentUser.settings")}
					</button>
					{user.isAdmin && (
						<Link href={`/${locale}/crm/admin`} onClick={close} className={row}>
							<TbShieldCog size={17} className="text-[#8c948b]" />
							{t("adminCabinet")}
						</Link>
					)}
					<div className="my-4 border-t border-[rgba(255,255,255,0.07)]" />
					<button type="button" onClick={handleLogout} className={row}>
						<TbLogout size={17} className="text-[#8c948b]" />
						{t("currentUser.logout")}
					</button>
				</div>
			</Dropdown>
		</div>
	);
}
