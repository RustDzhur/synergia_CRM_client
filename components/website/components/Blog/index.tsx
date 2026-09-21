"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { BLOG } from "@/app/content/sitePages";
import { withLocale } from "@/app/utils/locale";
import PageShell from "../PageShell";

// Картинки постов лежат в public/images/blog
export const blogImage = (name: string) => `/images/blog/${name}.jpg`;

// Blog: сетка карточек 3×2 (десктоп), по две на планшете, по одной на телефоне. «Read More» ведёт на статью.
export default function BlogPage() {
	const locale = useLocale();
	return (
		<PageShell title={tx(BLOG.title, locale)} center>
			<ul className="grid gap-20 md:grid-cols-2 lg:grid-cols-3">
				{BLOG.posts.map((post) => (
					<li key={post.slug} className="group flex flex-col overflow-hidden rounded-8 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.12)] border-b-[3px] border-transparent transition-[border-color,transform] duration-200 hover:border-authBtn">
						<Link href={withLocale(locale, `/blog/${post.slug}`)} className="block">
							<Image src={blogImage(post.image)} alt="" width={400} height={276} className="h-[210px] w-full object-cover lg:h-[276px]" />
						</Link>
						<div className="flex flex-1 flex-col px-20 pb-24 pt-20">
							<h2 className="mb-12 text-18 lg:text-20 font-medium tracking-[0.4px] text-[#4D4D4D]">{tx(post.title, locale)}</h2>
							<p className="text-14 lg:text-16 leading-[1.7] tracking-[0.3px] text-[#666666]">{tx(post.excerpt, locale)}</p>
						</div>
						<Link href={withLocale(locale, `/blog/${post.slug}`)} className="border-t border-[#EFEFEF] px-20 py-16 text-16 font-medium text-[#4D4D4D] transition-colors group-hover:text-authBtn">
							{tx(BLOG.readMore, locale)}
						</Link>
					</li>
				))}
			</ul>
		</PageShell>
	);
}
