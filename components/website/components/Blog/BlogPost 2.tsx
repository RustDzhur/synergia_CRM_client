"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { BLOG } from "@/app/content/sitePages";
import { withLocale } from "@/app/utils/locale";
import PageShell from "../PageShell";
import { blogImage } from "./index";

// Страница статьи блога: /blog/<slug>
export default function BlogPost({ slug }: { slug: string }) {
	const locale = useLocale();
	const post = BLOG.posts.find((p) => p.slug === slug);
	if (!post) return null;
	const date = new Date(post.date).toLocaleDateString(locale === "ua" ? "uk-UA" : locale === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
	return (
		<PageShell title={tx(post.title, locale)}>
			<p className="-mt-10 mb-24 text-14 text-[#999999]">{date}</p>
			<Image src={blogImage(post.image)} alt="" width={400} height={276} className="mb-30 h-auto w-full max-w-[800px] rounded-16 object-cover" />
			<div className="max-w-[760px]">
				{post.body.map((p, i) => (
					<p key={i} className="mb-20 text-16 lg:text-18 leading-[1.7] tracking-[0.4px] text-discover">{tx(p, locale)}</p>
				))}
			</div>
			<Link href={withLocale(locale, "/blog")} className="mt-20 inline-block text-16 font-medium text-authBtn hover:opacity-80">← {tx(BLOG.back, locale)}</Link>
		</PageShell>
	);
}
