"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { stripLocale } from "@/app/utils/locale";

interface NavLinkProps {
	href: string;
	children: React.ReactNode | string;
}

export default function NavLink({ href, children }: NavLinkProps) {
	const pathname = usePathname();
	const isActive = stripLocale(pathname) === stripLocale(href);

	return (
		<Link
			href={href}
			className={` hover:text-activeMenu ${
				isActive ? "text-activeMenu active-link" : "text-menu"
			}`}>
			{children}
		</Link>
	);
}
