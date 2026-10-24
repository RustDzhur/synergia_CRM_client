"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { stripLocale } from "@/utils/locale";

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
			className={`transition-colors duration-150 hover:text-[#edf2ff] ${
				isActive ? "text-[#edf2ff]" : "text-[#9aa7c9]"
			}`}>
			{children}
		</Link>
	);
}
