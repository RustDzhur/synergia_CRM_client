"use client";
import "react";
import { useTranslations } from "next-intl";
import BrandMark from "@/components/crm/components/shared/BrandMark";
import Breadcrumb from "./components/Breadcrumb";
import Search from "./components/Search";
import SwitchLanguage from "./components/SwitchLanguage";
import Notification from "./components/Notification";
import AiButton from "./components/AiButton";
import MobileMenu from "./components/MobileMenu";

// Шапка кабинета (64px): слева — где мы находимся, справа — поиск, помощник, язык, уведомления, статус доступа.
// Имя пользователя, фирма и выход живут в подвале сайдбара, поэтому здесь их нет.
// На телефоне сайдбара не видно — вместо крошек стоят знак бренда и кнопка меню.
function Layout() {
	const t = useTranslations("navBar");
	return (
		<div className="flex w-full items-center gap-16">
			{/* Телефон: знак бренда и название продукта — сайдбара с логотипом тут нет */}
			<div className="flex min-w-0 items-center gap-10 md:hidden">
				<BrandMark size={26} />
				<span className="truncate text-15 font-semibold tracking-[-0.2px] text-[#f1f4ee]">
					Firmspace <span className="text-[#c6ff4d]">AI</span>
				</span>
			</div>

			<div className="hidden min-w-0 md:block">
				<Breadcrumb />
			</div>

			<div className="ml-auto flex shrink-0 items-center gap-14">
				<div className="hidden lg:block">
					<Search />
				</div>
				<AiButton />
				<div className="hidden md:block">
					<SwitchLanguage />
				</div>
				<Notification />
				{/* Индикатор защищённого контура: в макете стоит справа в шапке */}
				<span className="fs-chip hidden lg:inline-flex">
					<span className="h-6 w-6 rounded-50 bg-[#c6ff4d]" aria-hidden />
					{t("protectedArea")}
				</span>
				{/* На планшете и телефоне узкий сайдбар не помещается в экран — разделы открываются этой кнопкой */}
				<div className="md:hidden">
					<MobileMenu />
				</div>
			</div>
		</div>
	);
}

export default Layout;
