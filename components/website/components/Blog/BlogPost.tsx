"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { tx } from "@/app/content/i18n";
import { BLOG } from "@/app/content/sitePages";
import { withLocale } from "@/app/utils/locale";
import PageShell from "../PageShell";
import { blogImage, type BlogPostDTO } from "./index";

// Страница статьи блога: /blog/<slug> — статья приходит из БД (/api/blog/:slug)
export default function BlogPost({ slug }: { slug: string }) {
	const locale = useLocale();
	const [post, setPost] = useState<BlogPostDTO | null | undefined>(undefined); // undefined = ещё грузится, null = не найдено

	useEffect(() => {
		setPost(undefined);
		fetch(`/api/blog/${slug}`).then((r) => (r.ok ? r.json() : null)).then(setPost).catch(() => setPost(null));
	}, [slug]);

	if (post === undefined) return null;
	if (post === null) {
		return (
			<PageShell title={tx(BLOG.back, locale)}>
				<Link href={withLocale(locale, "/blog")} className="text-16 font-medium text-authBtn hover:opacity-80">← {tx(BLOG.back, locale)}</Link>
			</PageShell>
		);
	}
	const date = new Date(post.publishedAt).toLocaleDateString(locale === "ua" ? "uk-UA" : locale === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
	return (
		<PageShell title={tx(post.title as any, locale)}>
			<p className="-mt-10 mb-24 text-14 text-[#999999]">{date}</p>
			<Image src={blogImage(post.image)} alt="" width={400} height={276} className="mb-30 h-auto w-full max-w-[800px] rounded-16 object-cover" unoptimized={post.image.startsWith("http")} />
			<div className="max-w-[760px]">
				{post.body.map((p, i) => (
					<p key={i} className="mb-20 text-16 lg:text-18 leading-[1.7] tracking-[0.4px] text-discover">{tx(p as any, locale)}</p>
				))}
			</div>
			<Link href={withLocale(locale, "/blog")} className="mt-20 inline-block text-16 font-medium text-authBtn hover:opacity-80">← {tx(BLOG.back, locale)}</Link>
		</PageShell>
	);
}
