"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { stripLocale } from "@/app/utils/locale";

interface NavLinkProps {
	href: string;
	children: React.ReactNode | string;
}

// Ссылка верхнего меню сайта: приглушённый серый, при наведении и на активной странице — светлый.
export default function NavLink({ href, children }: NavLinkProps) {
	const pathname = usePathname();
	const isActive = stripLocale(pathname) === stripLocale(href);

	return (
		<Link
			href={href}
			className={`transition-colors duration-150 hover:text-[#f1f4ee] ${
				isActive ? "text-[#f1f4ee]" : "text-[#8c948b]"
			}`}>
			{children}
		</Link>
	);
}
