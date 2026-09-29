"use client";
import Link from "next/link";
import "react";
import { useLocale } from "next-intl";
import BrandMark from "@/components/crm/shared/BrandMark";
import { withLocale } from "@/utils/locale";

// Логотип сайта: по клику — на главную страницу выбранного языка
export default function Logo({ light = false }: { light?: boolean }) {
	const locale = useLocale();
	return (
		<Link
			href={withLocale(locale, "/")}
			aria-label="Firmspace AI"
			// С главной страницы нажатие ведёт на неё же, и без этого страница не возвращалась наверх
			onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
			className="flex items-center gap-10">
			<BrandMark size={30} />
			<span
				className={`text-17 font-semibold leading-normal tracking-[-0.2px] lg:text-18 ${
					light ? "text-white" : "text-[#f1f4ee]"
				}`}>
				Firmspace <span className="text-[#c6ff4d]">AI</span>
			</span>
		</Link>
	);
}
